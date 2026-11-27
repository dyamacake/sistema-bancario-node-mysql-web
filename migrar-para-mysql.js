import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';

async function migrar() {
  // 1. Abre o banco SQLite de origem
  const sqlite = new Database('e:\\testes\\teste_db_node.db', { readonly: true });

  // 2. Conecta no MySQL usando o usuário admin criado
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'admin',
    password: 'Total12',
    database: 'teste_db_banco_my'
  });

  console.log('Conectado ao SQLite e ao MySQL! Iniciando migração...');

  try {
    await conn.beginTransaction();

    // Limpa tabelas de destino caso rode o script mais de uma vez
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE extrato');
    await conn.query('TRUNCATE TABLE conta_corrente');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 3. Migra conta_corrente mantendo os códigos originais
    const contas = sqlite.prepare('SELECT codigo, nome, data, saldo FROM conta_corrente').all();
    for (const c of contas) {
      await conn.execute(
        'INSERT INTO conta_corrente (codigo, nome, data, saldo) VALUES (?, ?, ?, ?)',
        [c.codigo, c.nome, c.data, c.saldo]
      );
    }
    console.log(`${contas.length} contas migradas.`);

    // 4. Migra extrato mantendo os IDs originais (caso a tabela exista no SQLite)
    const temExtrato = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='extrato'").get();
    if (temExtrato) {
      const extratos = sqlite.prepare('SELECT id, conta_codigo, tipo, valor, data_hora FROM extrato').all();
      for (const e of extratos) {
        await conn.execute(
          'INSERT INTO extrato (id, conta_codigo, tipo, valor, data_hora) VALUES (?, ?, ?, ?, ?)',
          [e.id, e.conta_codigo, e.tipo, e.valor, e.data_hora]
        );
      }
      console.log(`${extratos.length} registros de extrato migrados.`);
    }

    await conn.commit();
    console.log('Migração concluída com sucesso!');
  } catch (erro) {
    await conn.rollback();
    console.error('Erro na migração:', erro.message);
  } finally {
    sqlite.close();
    await conn.end();
  }
}

migrar();
