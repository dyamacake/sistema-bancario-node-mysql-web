# 🏦 Sistema Bancário Full-Stack (Node.js + MySQL)

Aplicação web completa de gestão de contas-correntes com controle de acesso por perfis, recuperação de senha por pergunta secreta, auditoria paginada (logs), painel gerencial sob demanda, transações financeiras seguras, geração de extratos em PDF/CSV e testes automatizados.

---

## ✨ Funcionalidades e Regras de Interface

- **Painel Gerencial Sob Demanda (Checkboxes):**
  - **Mostrar Resumo Financeiro:** Inicia desmarcado por padrão; ao habilitar, exibe os cards de **Clientes Ativos** e **Saldo Total Custodiado** em tempo real.
  - **Mostrar Gráficos de Saldos e Distribuição:** Inicia desmarcado por padrão; ao habilitar, exibe os gráficos visuais de **Ranking de Saldos por Cliente (R$)** e **Distribuição do Saldo Total (%)**.
- **Controle de Interface e Permissões por Perfil:**
  - **`admin`:** Acesso irrestrito a todas as operações, exclusão de contas, gestão de usuários e consulta paginada de logs de auditoria.
  - **`operador`:** Acesso aos formulários de **Nova Conta** e **Transferência entre Contas**, além de depósitos, saques e extratos.
  - **`consulta`:** Interface adaptada exclusivamente para leitura — os blocos **Nova Conta** e **Transferência** ficam ocultos, e os campos/botões de **Depositar**, **Sacar** e **Excluir** aparecem visualmente desabilitados na tabela, mantendo ativos apenas a busca e os extratos (tela, CSV e PDF).
- **Autenticação, Bloqueio e Recuperação de Senha:**
  - Login com sessão via token (`Bearer Token`) e expiração automática após **15 minutos** de inatividade.
  - Bloqueio automático de conta (`ativo = 'Nao'`) após exceder **3 tentativas** de senha incorretas.
  - Fluxo **"Esqueci minha senha"** com validação por **Pergunta e Resposta Secreta** (hash SHA-256) e desbloqueio automático da conta.
- **Gestão de Usuários (Exclusivo Admin):** Cadastro de novos usuários, definição de pergunta secreta, alteração de senhas, reativação de contas bloqueadas, visualização do último acesso e exportação em CSV.
- **Auditoria Paginada (Logs):** Registro automático de todas as ações (login, consultas, movimentações, recuperação de senha, exportações e exclusões) com paginação, filtro por usuário, faixa de datas e exportação em CSV.
- **Relatórios:** Exportação de extratos em **PDF** (`pdfkit`) e listas em **CSV** compatíveis com Excel (UTF-8 com BOM).

---

## 🛠️ Tecnologias Utilizadas

- **Back-end:** Node.js (ES Modules, `node:crypto`, `node:test`), Express
- **Banco de Dados:** MySQL 8+ (`mysql2/promise` com Pool de Conexões)
- **Front-end:** HTML5, CSS3 e JavaScript puro (Vanilla JS com manipulação nativa do DOM)
- **Documentos:** `pdfkit` para geração de PDF

---

## 🚀 Como Instalar e Rodar Localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org) (v20 ou superior, com suporte nativo a `--env-file`)
- [MySQL Server](https://mysql.com) rodando localmente na porta `3306`

### 2. Clonar o repositório e instalar dependências
```bash
git clone https://github.com
cd SEU-REPOSITORIO
npm install
```

### 3. Configurar o Banco de Dados MySQL
Execute o script SQL abaixo no seu servidor MySQL para criar o banco, todas as tabelas e os usuários iniciais:

```sql
CREATE DATABASE IF NOT EXISTS teste_db_banco_my
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE teste_db_banco_my;

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
  CONSTRAINT fk_extrato_conta
    FOREIGN KEY (conta_codigo) REFERENCES conta_corrente(codigo)
    ON DELETE CASCADE
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
```

### 4. Configurar variáveis de ambiente
Copie o arquivo modelo `.env.example` para `.env` e preencha suas credenciais do MySQL:

```powershell
Copy-Item .env.example .env
```

### 5. Executar a aplicação e os testes
- **Rodar testes automatizados:**
  ```bash
  npm test
  ```
- **Iniciar servidor em modo desenvolvimento (com reinício automático):**
  ```bash
  npm run dev
  ```
- Acesse no navegador: **`http://localhost:3000`**

---

## 🔐 Credenciais Padrão de Teste

| Usuário | Senha | Resposta Secreta | Permissões na Interface e API |
| :--- | :--- | :--- | :--- |
| **`admin`** | `Total12` | `banco` | Acesso total, exclusão de contas, gestão de usuários e logs paginados |
| **`operador`** | `Gestor34` | `banco` | Nova conta, transferências, depósitos, saques e extratos |
| **`consulta`** | `Extrato56` | `banco` | Somente leitura (oculta formulários e desabilita botões de movimentação/exclusão) |
