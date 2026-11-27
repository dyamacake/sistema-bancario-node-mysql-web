@'
CREATE DATABASE IF NOT EXISTS teste_db_banco_my CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE teste_db_banco_my;
'@ | Set-Content -Path setup.sql -Encoding UTF8

node --env-file=.env -e "import('fs').then(async fs => { const sql = fs.readFileSync('setup.sql', 'utf8'); const mysql = await import('mysql2/promise'); const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASS, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, multipleStatements: true }); await conn.query(sql); console.log('Tabelas criadas no TiDB Cloud com sucesso!'); await conn.end(); })"
