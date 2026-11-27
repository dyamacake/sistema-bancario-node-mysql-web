// Regras de negócio assíncronas (bancoService.js)

import pool from './db.js';

export async function listarContas(busca = '') {
  let linhas;
  if (busca && busca.trim() !== '') {
    [linhas] = await pool.query(
      'SELECT * FROM conta_corrente WHERE nome LIKE ? ORDER BY saldo DESC',
      [`%${busca.trim()}%`]
    );
  } else {
    [linhas] = await pool.query('SELECT * FROM conta_corrente ORDER BY saldo DESC');
  }
  return linhas.map(c => ({ ...c, saldo: Number(c.saldo) }));
}

export async function listarExtrato(codigo) {
  const [linhas] = await pool.query(
    'SELECT * FROM extrato WHERE conta_codigo = ? ORDER BY id DESC',
    [codigo]
  );
  return linhas.map(i => ({ ...i, valor: Number(i.valor) }));
}

export async function cadastrarConta(nome, saldoInicial) {
  if (!nome || nome.trim() === '') throw new Error('O nome do cliente é obrigatório.');
  if (isNaN(saldoInicial) || saldoInicial < 0) throw new Error('Saldo inicial inválido.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hoje = new Date().toISOString().slice(0, 10);
    const agora = new Date().toLocaleString('pt-BR');

    const [info] = await conn.execute(
      'INSERT INTO conta_corrente (nome, data, saldo) VALUES (?, ?, ?)',
      [nome.trim(), hoje, saldoInicial]
    );

    const novoCodigo = info.insertId;

    if (saldoInicial > 0) {
      await conn.execute(
        'INSERT INTO extrato (conta_codigo, tipo, valor, data_hora) VALUES (?, ?, ?, ?)',
        [novoCodigo, 'ABERTURA', saldoInicial, agora]
      );
    }

    await conn.commit();
    return { codigo: novoCodigo, nome: nome.trim(), data: hoje, saldo: Number(saldoInicial) };
  } catch (erro) {
    await conn.rollback();
    throw erro;
  } finally {
    conn.release();
  }
}

export async function movimentarSaldo(codigo, valor) {
  if (isNaN(valor) || valor === 0) throw new Error('Informe um valor diferente de zero.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE bloqueia a linha durante a transação para evitar saque duplo simultâneo
    const [rows] = await conn.query(
      'SELECT * FROM conta_corrente WHERE codigo = ? FOR UPDATE',
      [codigo]
    );
    const [conta] = rows;

    if (!conta) throw new Error(`Conta ${codigo} não encontrada.`);

    const saldoAtual = Number(conta.saldo);
    const novoSaldo = saldoAtual + valor;
    if (novoSaldo < 0) throw new Error(`Saldo insuficiente (Atual: R$ ${saldoAtual.toFixed(2)}).`);

    const agora = new Date().toLocaleString('pt-BR');
    const tipo = valor > 0 ? 'DEPÓSITO' : 'SAQUE';

    await conn.execute('UPDATE conta_corrente SET saldo = ? WHERE codigo = ?', [novoSaldo, codigo]);
    await conn.execute(
      'INSERT INTO extrato (conta_codigo, tipo, valor, data_hora) VALUES (?, ?, ?, ?)',
      [codigo, tipo, valor, agora]
    );

    await conn.commit();
    return { ...conta, saldo: novoSaldo };
  } catch (erro) {
    await conn.rollback();
    throw erro;
  } finally {
    conn.release();
  }
}

export async function transferir(origemCodigo, destinoCodigo, valor) {
  if (origemCodigo === destinoCodigo) throw new Error('A conta de destino deve ser diferente da origem.');
  if (isNaN(valor) || valor <= 0) throw new Error('O valor da transferência deve ser maior que zero.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rowsOrigem] = await conn.query('SELECT * FROM conta_corrente WHERE codigo = ? FOR UPDATE', [origemCodigo]);
    const [rowsDestino] = await conn.query('SELECT * FROM conta_corrente WHERE codigo = ? FOR UPDATE', [destinoCodigo]);

    const [origem] = rowsOrigem;
    const [destino] = rowsDestino;

    if (!origem) throw new Error(`Conta de origem (${origemCodigo}) não encontrada.`);
    if (!destino) throw new Error(`Conta de destino (${destinoCodigo}) não encontrada.`);
    if (Number(origem.saldo) < valor) throw new Error(`Saldo insuficiente na conta ${origemCodigo}.`);

    const agora = new Date().toLocaleString('pt-BR');

    await conn.execute('UPDATE conta_corrente SET saldo = saldo - ? WHERE codigo = ?', [valor, origemCodigo]);
    await conn.execute('UPDATE conta_corrente SET saldo = saldo + ? WHERE codigo = ?', [valor, destinoCodigo]);

    await conn.execute(
      'INSERT INTO extrato (conta_codigo, tipo, valor, data_hora) VALUES (?, ?, ?, ?)',
      [origemCodigo, `TRANSF. ENVIADA (P/ Cód ${destinoCodigo})`, -valor, agora]
    );
    await conn.execute(
      'INSERT INTO extrato (conta_codigo, tipo, valor, data_hora) VALUES (?, ?, ?, ?)',
      [destinoCodigo, `TRANSF. RECEBIDA (De Cód ${origemCodigo})`, valor, agora]
    );

    await conn.commit();
    return { mensagem: 'Transferência realizada com sucesso!' };
  } catch (erro) {
    await conn.rollback();
    throw erro;
  } finally {
    conn.release();
  }
}

export async function excluirConta(codigo) {
  const [info] = await pool.execute('DELETE FROM conta_corrente WHERE codigo = ?', [codigo]);
  if (info.affectedRows === 0) throw new Error(`Conta ${codigo} não encontrada.`);
  return { mensagem: `Conta ${codigo} excluída com sucesso!` };
}

export async function obterDadosGraficos() {
  const [saldosPorCliente] = await pool.query(
    'SELECT nome, saldo FROM conta_corrente ORDER BY saldo DESC LIMIT 10'
  );

  const [movimentacoesPorTipo] = await pool.query(`
    SELECT
      CASE
        WHEN tipo LIKE 'TRANSF. ENVIADA%' THEN 'TRANSF. ENVIADA'
        WHEN tipo LIKE 'TRANSF. RECEBIDA%' THEN 'TRANSF. RECEBIDA'
        ELSE tipo
      END AS categoria,
      SUM(ABS(valor)) AS total
    FROM extrato
    GROUP BY categoria
    ORDER BY total DESC
  `);

  return {
    saldos: saldosPorCliente.map(c => ({ nome: c.nome, saldo: Number(c.saldo) })),
    movimentacoes: movimentacoesPorTipo.map(m => ({ categoria: m.categoria, total: Number(m.total) }))
  };
}

