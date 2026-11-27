import pool from './db.js';

export async function registrarLog(usuarioId, usuarioNome, funcao, descricao) {
  try {
    await pool.execute(
      'INSERT INTO logs (data_hora, usuario_id, usuario_nome, funcao, descricao) VALUES (NOW(), ?, ?, ?, ?)',
      [usuarioId || null, usuarioNome || 'Sistema', funcao, descricao]
    );
  } catch (erro) {
    console.error('Falha ao gravar log:', erro.message);
  }
}

export async function consultarLogs(dataInicio = '', dataFim = '', usuario = '', pagina = 1, limite = 15, semPaginacao = false) {
  let filtroSql = ' WHERE 1=1';
  const params = [];

  if (dataInicio) {
    filtroSql += ' AND DATE(data_hora) >= ?';
    params.push(dataInicio);
  }
  if (dataFim) {
    filtroSql += ' AND DATE(data_hora) <= ?';
    params.push(dataFim);
  }
  if (usuario && usuario.trim() !== '') {
    filtroSql += ' AND usuario_nome LIKE ?';
    params.push('%' + usuario.trim() + '%');
  }

  // Se for exportação CSV, retorna todos os registros filtrados
  if (semPaginacao) {
    const sqlCompleto = `
      SELECT
        id,
        DATE_FORMAT(data_hora, '%d/%m/%Y %H:%i:%s') AS data_hora_fmt,
        usuario_id,
        usuario_nome,
        funcao,
        descricao
      FROM logs
      ${filtroSql}
      ORDER BY data_hora DESC, id DESC
    `;
    const [rows] = await pool.query(sqlCompleto, params);
    return rows;
  }

  // 1. Conta o total de registros que atendem ao filtro
  const [contagem] = await pool.query('SELECT COUNT(*) AS total FROM logs' + filtroSql, params);
  const totalRegistros = Number(contagem[0].total);

  const limiteSeguro = Math.max(1, Math.min(100, Number(limite) || 15));
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limiteSeguro));
  const paginaAtual = Math.max(1, Math.min(totalPaginas, Number(pagina) || 1));
  const offset = (paginaAtual - 1) * limiteSeguro;

  // 2. Busca apenas os registros da página atual
  const sqlPaginado = `
    SELECT
      id,
      DATE_FORMAT(data_hora, '%d/%m/%Y %H:%i:%s') AS data_hora_fmt,
      usuario_id,
      usuario_nome,
      funcao,
      descricao
    FROM logs
    ${filtroSql}
    ORDER BY data_hora DESC, id DESC
    LIMIT ? OFFSET ?
  `;

  const [registros] = await pool.query(sqlPaginado, [...params, limiteSeguro, offset]);

  return {
    registros,
    totalRegistros,
    paginaAtual,
    totalPaginas,
    limite: limiteSeguro
  };
}
