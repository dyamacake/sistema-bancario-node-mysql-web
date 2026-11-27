import express from 'express';
import PDFDocument from 'pdfkit';
import { registrarLog, consultarLogs } from './logService.js';

import {
  autenticar,
  encerrarSessao,
  exigirPermissao,
  listarUsuarios,
  salvarUsuario,
  excluirUsuario,
  buscarPerguntaSecreta,
  redefinirSenhaComResposta
} from './authService.js';



import {
  listarContas,
  listarExtrato,
  cadastrarConta,
  movimentarSaldo,
  transferir,
  excluirConta,
  obterDadosGraficos
} from './bancoService.js';


const app = express();
app.use(express.json());
app.use(express.static('public'));


app.use('/vendor/chart.js', express.static('node_modules/chart.js/dist'));


app.post('/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    res.json(await autenticar(usuario, senha));
  } catch (erro) {
    res.status(401).json({ erro: erro.message });
  }
});

app.post('/logout', async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) await encerrarSessao(token);
  res.json({ mensagem: 'Sessão encerrada.' });
});



// Etapa 1: Recebe o nome do usuário e devolve a pergunta secreta cadastrada no MySQL
app.post('/recuperar-senha/pergunta', async (req, res) => {
  try {
    res.json(await buscarPerguntaSecreta(req.body.usuario));
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

// Etapa 2: Valida a resposta secreta, grava a nova senha e desbloqueia a conta (ativo = 'Sim')
app.post('/recuperar-senha/redefinir', async (req, res) => {
  try {
    const { usuario, resposta, novaSenha } = req.body;
    res.json(await redefinirSenhaComResposta(usuario, resposta, novaSenha));
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});



app.get('/contas', exigirPermissao(['consulta', 'operador', 'admin']), async (req, res) => {
  try {
    const busca = req.query.busca || '';
    const contas = await listarContas(busca);
    const detalhe = busca ? "Consultou contas filtrando por '" + busca + "'." : 'Listou todas as contas.';
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'CONSULTAR_CONTAS', detalhe);
    res.json(contas);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.get('/contas/:codigo/extrato', exigirPermissao(['consulta', 'operador', 'admin']), async (req, res) => {
  try {
    const codigo = Number(req.params.codigo);
    const itens = await listarExtrato(codigo);
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'CONSULTAR_EXTRATO', 'Consultou extrato da conta ' + codigo + '.');
    res.json(itens);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.get('/contas/:codigo/extrato/csv', exigirPermissao(['consulta', 'operador', 'admin']), async (req, res) => {
  try {
    const codigo = Number(req.params.codigo);
    const itens = await listarExtrato(codigo);
    const cabecalho = 'Data/Hora;Tipo;Valor (R$)\n';
    const linhas = itens.map(i => i.data_hora + ';' + i.tipo + ';' + i.valor.toFixed(2).replace('.', ',')).join('\n');

    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'EXPORTAR_CSV', 'Exportou extrato CSV da conta ' + codigo + '.');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="extrato_conta_' + codigo + '.csv"');
    res.send('\uFEFF' + cabecalho + linhas);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

app.get('/contas/:codigo/extrato/pdf', exigirPermissao(['consulta', 'operador', 'admin']), async (req, res) => {
  try {
    const codigo = Number(req.params.codigo);
    const contas = await listarContas();
    const conta = contas.find(c => c.codigo === codigo);
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' });

    const itens = await listarExtrato(codigo);
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'EXPORTAR_PDF', 'Exportou extrato PDF da conta ' + codigo + '.');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="extrato_conta_' + codigo + '.pdf"');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).fillColor('#0066cc').text('BANCO NODE + MYSQL S.A.', { align: 'center' });
    doc.fontSize(10).fillColor('#555').text('Emitido em: ' + new Date().toLocaleString('pt-BR'), { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke('#ccc');
    doc.moveDown();

    doc.fontSize(12).fillColor('#000').text('Cliente: ' + conta.nome + ' (Conta Cód. ' + conta.codigo + ')');
    doc.fontSize(12).text('Saldo Atual: R$ ' + conta.saldo.toFixed(2));
    doc.moveDown();

    doc.fontSize(11).fillColor('#0066cc').text('Histórico de Movimentações:');
    doc.moveDown(0.5);

    if (itens.length === 0) {
      doc.fontSize(10).fillColor('#666').text('Nenhuma movimentação registrada.');
    } else {
      itens.forEach(item => {
        const sinal = item.valor >= 0 ? '+' : '';
        doc.fontSize(10).fillColor('#222')
          .text(item.data_hora + '  |  ' + item.tipo + '  |  ' + sinal + 'R$ ' + item.valor.toFixed(2));
      });
    }

    doc.end();
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});


app.get('/graficos', exigirPermissao(['consulta', 'operador', 'admin']), async (req, res) => {
  try {
    res.json(await obterDadosGraficos());
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});


app.post('/contas', exigirPermissao(['operador', 'admin']), async (req, res) => {
  try {
    const nova = await cadastrarConta(req.body.nome, Number(req.body.saldo));
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'CADASTRAR_CONTA', 'Cadastrou conta ' + nova.codigo + ' (' + nova.nome + ') com saldo R$ ' + nova.saldo.toFixed(2));
    res.status(201).json(nova);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

app.patch('/contas/:codigo/movimentar', exigirPermissao(['operador', 'admin']), async (req, res) => {
  try {
    const codigo = Number(req.params.codigo);
    const valor = Number(req.body.valor);
    const atualizada = await movimentarSaldo(codigo, valor);
    const tipo = valor > 0 ? 'DEPOSITO' : 'SAQUE';
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, tipo, tipo + ' de R$ ' + Math.abs(valor).toFixed(2) + ' na conta ' + codigo + '.');
    res.json(atualizada);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

app.post('/transferir', exigirPermissao(['operador', 'admin']), async (req, res) => {
  try {
    const { origem, destino, valor } = req.body;
    const resultado = await transferir(Number(origem), Number(destino), Number(valor));
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'TRANSFERENCIA', 'Transferiu R$ ' + Number(valor).toFixed(2) + ' da conta ' + origem + ' para ' + destino + '.');
    res.json(resultado);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

app.delete('/contas/:codigo', exigirPermissao(['admin']), async (req, res) => {
  try {
    const codigo = Number(req.params.codigo);
    const resultado = await excluirConta(codigo);
    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'EXCLUIR_CONTA', 'Excluiu a conta código ' + codigo + '.');
    res.json(resultado);
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

// Gestão de Usuários (Admin)
app.get('/usuarios', exigirPermissao(['admin']), async (req, res) => {
  try {
    res.json(await listarUsuarios());
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});



app.post('/usuarios', exigirPermissao(['admin']), async (req, res) => {
  try {
    const { usuario, senha, perfil, perguntaSecreta, respostaSecreta } = req.body;
    res.json(await salvarUsuario(usuario, senha, perfil, req.usuarioLogado, perguntaSecreta, respostaSecreta));
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});




app.delete('/usuarios/:id', exigirPermissao(['admin']), async (req, res) => {
  try {
    res.json(await excluirUsuario(Number(req.params.id), req.usuarioLogado));
  } catch (erro) {
    res.status(400).json({ erro: erro.message });
  }
});

// Consulta Paginada de Logs de Auditoria (Exclusivo Admin)
app.get('/logs', exigirPermissao(['admin']), async (req, res) => {
  try {
    const { dataInicio, dataFim, usuario, pagina, limite } = req.query;
    res.json(await consultarLogs(dataInicio, dataFim, usuario, pagina, limite, false));
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando com auditoria em: http://localhost:' + PORT));


// Exportar Usuários em CSV (Admin)
app.get('/usuarios/csv', exigirPermissao(['admin']), async (req, res) => {
  try {
    const lista = await listarUsuarios();
    const cabecalho = 'ID;Usuario;Perfil;Ultimo Acesso;Ativo\n';
    const linhas = lista.map(u =>
      u.id + ';' + u.usuario + ';' + u.perfil + ';' + (u.ultimo_acesso || 'Nunca acessou') + ';' + u.ativo
    ).join('\n');

    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'EXPORTAR_USUARIOS_CSV', 'Exportou lista de usuários em CSV.');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="usuarios_sistema.csv"');
    res.send('\uFEFF' + cabecalho + linhas);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// Exportar Todos os Logs Filtrados em CSV (Admin)
app.get('/logs/csv', exigirPermissao(['admin']), async (req, res) => {
  try {
    const { dataInicio, dataFim, usuario } = req.query;
    const logs = await consultarLogs(dataInicio, dataFim, usuario, 1, 10000, true);
    const cabecalho = 'Data/Hora;ID Usuario;Usuario;Funcao;Descricao\n';
    const linhas = logs.map(l =>
      l.data_hora_fmt + ';' + (l.usuario_id || '') + ';' + l.usuario_nome + ';' + l.funcao + ';' + l.descricao
    ).join('\n');

    await registrarLog(req.usuarioLogado.id, req.usuarioLogado.usuario, 'EXPORTAR_LOGS_CSV', 'Exportou logs de auditoria em CSV.');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="logs_auditoria.csv"');
    res.send('\uFEFF' + cabecalho + linhas);
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});




