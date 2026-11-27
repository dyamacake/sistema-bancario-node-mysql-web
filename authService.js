import crypto from 'node:crypto';
import pool from './db.js';
import { registrarLog } from './logService.js';

const sessoesAtivas = new Map();
const TEMPO_EXPIRACAO_MS = 15 * 60 * 1000;

function gerarHash(senha) {
  return crypto.createHash('sha256').update(senha).digest('hex');
}

export async function autenticar(usuario, senha) {
  const [rows] = await pool.query(
    'SELECT id, usuario, senha_hash, perfil, ativo, tentativas_falhas, ultimo_acesso FROM usuarios WHERE usuario = ?',
    [usuario]
  );
  const [registro] = rows;

  if (!registro) {
    await registrarLog(null, usuario || 'Desconhecido', 'LOGIN_FALHA', 'Tentativa de login com usuário inexistente.');
    throw new Error('Usuário ou senha inválidos.');
  }

  if (registro.ativo === 'Nao') {
    await registrarLog(registro.id, registro.usuario, 'LOGIN_BLOQUEADO', 'Tentativa de acesso em conta bloqueada.');
    throw new Error("Usuário '" + usuario + "' bloqueado por excesso de tentativas. Contate o administrador.");
  }

  if (registro.senha_hash !== gerarHash(senha)) {
    const novasTentativas = registro.tentativas_falhas + 1;

    if (novasTentativas > 3) {
      await pool.execute(
        "UPDATE usuarios SET tentativas_falhas = ?, ativo = 'Nao' WHERE id = ?",
        [novasTentativas, registro.id]
      );
      await registrarLog(registro.id, registro.usuario, 'BLOQUEIO_USUARIO', 'Usuário bloqueado após exceder 3 tentativas.');
      throw new Error("Usuário '" + usuario + "' bloqueado (ativo = Nao) após exceder 3 tentativas incorretas.");
    } else {
      await pool.execute(
        'UPDATE usuarios SET tentativas_falhas = ? WHERE id = ?',
        [novasTentativas, registro.id]
      );
      await registrarLog(registro.id, registro.usuario, 'LOGIN_FALHA', 'Senha incorreta (Tentativa ' + novasTentativas + ' de 3).');
      throw new Error('Usuário ou senha inválidos. (Tentativa ' + novasTentativas + ' de 3)');
    }
  }

  const acessoAnterior = registro.ultimo_acesso || 'Primeiro acesso';
  const agora = new Date().toLocaleString('pt-BR');

  await pool.execute(
    'UPDATE usuarios SET tentativas_falhas = 0, ultimo_acesso = ? WHERE id = ?',
    [agora, registro.id]
  );

  const token = crypto.randomBytes(32).toString('hex');
  sessoesAtivas.set(token, {
    id: registro.id,
    usuario: registro.usuario,
    perfil: registro.perfil,
    ultimaAtividade: Date.now()
  });

  await registrarLog(registro.id, registro.usuario, 'LOGIN_SUCESSO', 'Acesso realizado com perfil ' + registro.perfil + '.');

  return {
    token,
    id: registro.id,
    usuario: registro.usuario,
    perfil: registro.perfil,
    ultimoAcesso: acessoAnterior
  };
}

export async function encerrarSessao(token) {
  const sessao = sessoesAtivas.get(token);
  if (sessao) {
    await registrarLog(sessao.id, sessao.usuario, 'LOGOUT', 'Usuário encerrou a sessão.');
    sessoesAtivas.delete(token);
  }
}

export function exigirPermissao(perfisPermitidos = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.query.token;

    if (!token || !sessoesAtivas.has(token)) {
      return res.status(401).json({ erro: 'Sessão não autenticada. Faça login.' });
    }

    const sessao = sessoesAtivas.get(token);

    if (Date.now() - sessao.ultimaAtividade > TEMPO_EXPIRACAO_MS) {
      registrarLog(sessao.id, sessao.usuario, 'SESSAO_EXPIRADA', 'Sessão encerrada após 15 minutos de inatividade.');
      sessoesAtivas.delete(token);
      return res.status(401).json({ erro: 'Sessão expirada após 15 minutos de inatividade. Faça login novamente.' });
    }

    sessao.ultimaAtividade = Date.now();

    if (perfisPermitidos.length > 0 && !perfisPermitidos.includes(sessao.perfil)) {
      registrarLog(sessao.id, sessao.usuario, 'ACESSO_NEGADO', 'Tentativa sem permissão na rota ' + req.method + ' ' + req.originalUrl);
      return res.status(403).json({
        erro: "Acesso negado: o perfil '" + sessao.perfil + "' não tem permissão para esta ação."
      });
    }

    req.usuarioLogado = sessao;
    next();
  };
}

export async function listarUsuarios() {
  const [rows] = await pool.query(
    'SELECT id, usuario, perfil, ultimo_acesso, ativo FROM usuarios ORDER BY id ASC'
  );
  return rows;
}

export async function salvarUsuario(usuario, senha, perfil, adminLogado, perguntaSecreta, respostaSecreta) {
  if (!usuario || usuario.trim() === '') throw new Error('O nome de usuário é obrigatório.');
  if (!senha || senha.length < 4) throw new Error('A senha deve ter pelo menos 4 caracteres.');
  if (!['admin', 'operador', 'consulta'].includes(perfil)) throw new Error('Perfil inválido.');

  const nomeLimpo = usuario.trim();
  const [existentes] = await pool.query('SELECT id FROM usuarios WHERE usuario = ?', [nomeLimpo]);
  const jaExiste = existentes.length > 0;

  const hashSenha = gerarHash(senha);
  const pergunta = (perguntaSecreta && perguntaSecreta.trim() !== '')
    ? perguntaSecreta.trim()
    : 'Qual o nome do sistema?';
  const respostaLimpa = (respostaSecreta && respostaSecreta.trim() !== '')
    ? respostaSecreta.trim().toLowerCase()
    : 'banco';
  const hashResposta = gerarHash(respostaLimpa);

  await pool.execute(
    `INSERT INTO usuarios (usuario, senha_hash, perfil, ativo, tentativas_falhas, pergunta_secreta, resposta_secreta_hash)
     VALUES (?, ?, ?, 'Sim', 0, ?, ?)
     ON DUPLICATE KEY UPDATE
       senha_hash = VALUES(senha_hash),
       perfil = VALUES(perfil),
       ativo = 'Sim',
       tentativas_falhas = 0,
       pergunta_secreta = VALUES(pergunta_secreta),
       resposta_secreta_hash = VALUES(resposta_secreta_hash)`,
    [nomeLimpo, hashSenha, perfil, pergunta, hashResposta]
  );

  if (jaExiste) {
    await registrarLog(adminLogado.id, adminLogado.usuario, 'ALTERAR_USUARIO', 'Alterou senha/perfil do usuário ' + nomeLimpo + ' (' + perfil + ').');
    return { mensagem: 'Senha do Usuário ' + nomeLimpo + ' Alterada!' };
  }

  await registrarLog(adminLogado.id, adminLogado.usuario, 'CADASTRAR_USUARIO', 'Cadastrou novo usuário ' + nomeLimpo + ' (' + perfil + ').');
  return { mensagem: 'Usuário ' + nomeLimpo + ' cadastrado!' };
}

export async function excluirUsuario(id, adminLogado) {
  const [rows] = await pool.query('SELECT usuario FROM usuarios WHERE id = ?', [id]);
  const [alvo] = rows;
  if (!alvo) throw new Error('Usuário não encontrado.');
  if (alvo.usuario === adminLogado.usuario) throw new Error('Você não pode excluir seu próprio usuário logado.');

  await pool.execute('DELETE FROM usuarios WHERE id = ?', [id]);
  await registrarLog(adminLogado.id, adminLogado.usuario, 'EXCLUIR_USUARIO', 'Excluiu o usuário ' + alvo.usuario + ' (ID ' + id + ').');
  return { mensagem: 'Usuário ' + alvo.usuario + ' Excluido!' };
}

export async function buscarPerguntaSecreta(usuario) {
  if (!usuario || usuario.trim() === '') throw new Error('Informe o nome de usuário.');
  const [rows] = await pool.query(
    'SELECT id, usuario, pergunta_secreta FROM usuarios WHERE usuario = ?',
    [usuario.trim()]
  );
  const [registro] = rows;
  if (!registro) throw new Error('Usuário não encontrado.');

  return { usuario: registro.usuario, perguntaSecreta: registro.pergunta_secreta };
}

export async function redefinirSenhaComResposta(usuario, resposta, novaSenha) {
  if (!usuario || !resposta || !novaSenha) throw new Error('Preencha todos os campos.');
  if (novaSenha.length < 4) throw new Error('A nova senha deve ter pelo menos 4 caracteres.');

  const [rows] = await pool.query(
    'SELECT id, usuario, resposta_secreta_hash FROM usuarios WHERE usuario = ?',
    [usuario.trim()]
  );
  const [registro] = rows;
  if (!registro) throw new Error('Usuário não encontrado.');

  const hashInformado = gerarHash(resposta.trim().toLowerCase());
  if (hashInformado !== registro.resposta_secreta_hash) {
    await registrarLog(registro.id, registro.usuario, 'RECUPERACAO_FALHA', 'Resposta secreta incorreta na recuperação de senha.');
    throw new Error('Resposta secreta incorreta.');
  }

  const novoHashSenha = gerarHash(novaSenha);
  await pool.execute(
    "UPDATE usuarios SET senha_hash = ?, ativo = 'Sim', tentativas_falhas = 0 WHERE id = ?",
    [novoHashSenha, registro.id]
  );

  await registrarLog(registro.id, registro.usuario, 'RECUPERACAO_SENHA', 'Senha redefinida e conta reativada via pergunta secreta.');
  return { mensagem: 'Senha redefinida com sucesso! Faça login com a nova senha.' };
}
