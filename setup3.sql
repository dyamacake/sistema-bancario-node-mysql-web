@'
CREATE TABLE IF NOT EXISTS conta_corrente (
  codigo INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  data VARCHAR(20) NOT NULL,
  saldo DECIMAL(15, 2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS extrato (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conta_codigo INT NOT NULL,
  tipo VARCHAR(100) NOT NULL,
  valor DECIMAL(15, 2) NOT NULL,
  data_hora VARCHAR(30) NOT NULL,
  CONSTRAINT fk_extrato_conta FOREIGN KEY (conta_codigo) REFERENCES conta_corrente(codigo) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  senha_hash VARCHAR(64) NOT NULL,
  perfil ENUM('admin', 'operador', 'consulta') NOT NULL,
  ultimo_acesso VARCHAR(30) NULL,
  ativo ENUM('Sim', 'Nao') NOT NULL DEFAULT 'Sim',
  tentativas_falhas INT NOT NULL DEFAULT 0,
  pergunta_secreta VARCHAR(150) NOT NULL DEFAULT 'Qual o nome do sistema?',
  resposta_secreta_hash VARCHAR(64) NOT NULL DEFAULT ''
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT NULL,
  usuario_nome VARCHAR(50) NOT NULL,
  funcao VARCHAR(80) NOT NULL,
  descricao VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO usuarios (usuario, senha_hash, perfil, pergunta_secreta, resposta_secreta_hash) VALUES
  ('admin', SHA2('Total12', 256), 'admin', 'Qual o nome do sistema?', SHA2('banco', 256)),
  ('operador', SHA2('Gestor34', 256), 'operador', 'Qual o nome do sistema?', SHA2('banco', 256)),
  ('consulta', SHA2('Extrato56', 256), 'consulta', 'Qual o nome do sistema?', SHA2('banco', 256));
'@ | Set-Content -Path setup.sql -Encoding UTF8

node --env-file=.env -e "import('fs').then(async fs => { const sql = fs.readFileSync('setup.sql', 'utf8'); const mysql = await import('mysql2/promise'); const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASS, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, multipleStatements: true }); await conn.query(sql); console.log('Tabelas criadas no TiDB Cloud com sucesso!'); await conn.end(); })"




