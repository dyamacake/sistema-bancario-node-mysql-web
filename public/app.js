const msg = document.getElementById('msg');
let contaExtratoAtual = null;
let timerInatividade = null;
const LIMITE_INATIVIDADE_MS = 15 * 60 * 1000;

function exibirAviso(texto, erro = false) {
  msg.style.display = 'block';
  msg.textContent = texto;
  msg.className = erro ? 'erro' : 'sucesso';
}

function limparAviso() {
  msg.style.display = 'none';
  msg.textContent = '';
}

function reiniciarTimerInatividade() {
  if (!sessionStorage.getItem('token')) return;
  clearTimeout(timerInatividade);
  timerInatividade = setTimeout(function () {
    sessionStorage.clear();
    atualizarTela('Sessão encerrada automaticamente após 15 minutos de inatividade.');
  }, LIMITE_INATIVIDADE_MS);
}

['click', 'keydown', 'mousemove'].forEach(function (evento) {
  document.addEventListener(evento, reiniciarTimerInatividade);
});

async function apiFetch(url, opcoes) {
  opcoes = opcoes || {};
  const token = sessionStorage.getItem('token');
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opcoes.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, Object.assign({}, opcoes, { headers: headers }));
  if (res.status === 401) {
    const dados = await res.json().catch(function () { return {}; });
    sessionStorage.clear();
    atualizarTela(dados.erro || 'Sessão expirada. Faça login novamente.');
  }
  return res;
}

function atualizarTela(avisoLogin) {
  const token = sessionStorage.getItem('token');
  const usuario = sessionStorage.getItem('usuario');
  const perfil = sessionStorage.getItem('perfil');
  const ultimoAcesso = sessionStorage.getItem('ultimoAcesso');
  const msgLogin = document.getElementById('msg-login');

  if (token) {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('tela-sistema').style.display = 'block';
    document.getElementById('info-usuario').textContent = 'Usuário: ' + usuario + ' (' + perfil + ')';
    document.getElementById('info-ultimo-acesso').textContent = 'Último acesso: ' + (ultimoAcesso || 'Primeiro acesso');

    const ehAdmin = (perfil === 'admin') ? 'inline-block' : 'none';
    document.getElementById('btn-aba-usuarios').style.display = ehAdmin;
    document.getElementById('btn-aba-logs').style.display = ehAdmin;


    // Controlar a visibilidade na função atualizarTela 
    // const ehAdmin = (perfil === 'admin') ? 'inline-block' : 'none';
    document.getElementById('btn-aba-usuarios').style.display = ehAdmin;
    document.getElementById('btn-aba-logs').style.display = ehAdmin;
    const boxOperacoes = document.getElementById('box-operacoes-conta');
    if (boxOperacoes) {
      boxOperacoes.style.display = (perfil === 'operador' || perfil === 'admin') ? 'grid' : 'none';
    }


    reiniciarTimerInatividade();
    alternarAba('contas');
  } else {
    clearTimeout(timerInatividade);
    document.getElementById('tela-login').style.display = 'block';
    document.getElementById('tela-sistema').style.display = 'none';
    if (avisoLogin) {
      msgLogin.className = 'erro';
      msgLogin.textContent = avisoLogin;
    } else {
      msgLogin.textContent = '';
    }
  }
}

window.alternarAba = function (aba) {
  limparAviso();
  document.getElementById('aba-contas').style.display = (aba === 'contas') ? 'block' : 'none';
  document.getElementById('aba-usuarios').style.display = (aba === 'usuarios') ? 'block' : 'none';
  document.getElementById('aba-logs').style.display = (aba === 'logs') ? 'block' : 'none';

  if (aba === 'contas') carregarContas();
  if (aba === 'usuarios') carregarUsuarios();
  if (aba === 'logs') carregarLogs();
};

window.fazerLogin = async function () {
  const usuario = document.getElementById('login-usuario').value.trim();
  const senha = document.getElementById('login-senha').value;
  const msgLogin = document.getElementById('msg-login');
  msgLogin.textContent = '';

  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: usuario, senha: senha })
    });
    const dados = await res.json();

    if (!res.ok) {
      msgLogin.className = 'erro';
      msgLogin.textContent = dados.erro || 'Erro ao fazer login.';
      return;
    }

    sessionStorage.setItem('token', dados.token);
    sessionStorage.setItem('usuario', dados.usuario);
    sessionStorage.setItem('perfil', dados.perfil);
    sessionStorage.setItem('ultimoAcesso', dados.ultimoAcesso);
    document.getElementById('login-senha').value = '';
    atualizarTela();
  } catch (e) {
    msgLogin.className = 'erro';
    msgLogin.textContent = 'Falha na comunicação com o servidor.';
  }
};

window.fazerLogout = async function () {
  await apiFetch('/logout', { method: 'POST' });
  sessionStorage.clear();
  atualizarTela();
};

// window.carregarContas = async function (exibirMsgFiltro) {
//   const busca = document.getElementById('campo-busca').value;
//   const res = await apiFetch('/contas?busca=' + encodeURIComponent(busca));
//   if (!res.ok) return;
//   const contas = await res.json();

//   if (exibirMsgFiltro) {
//     exibirAviso(busca ? 'Filtro aplicado: ' + contas.length + ' conta(s) encontrada(s).' : 'Filtro limpo!');
//   }

//   // const somaTotal = contas.reduce(function (acc, c) { return acc + Number(c.saldo); }, 0); 

//   const somaTotal = contas.reduce(function(acc, c) { return acc + Number(c.saldo); }, 0);
//   document.getElementById('resumo-qtd').textContent = contas.length;
//   document.getElementById('resumo-total').textContent = 'R$ ' + somaTotal.toFixed(2);
//   desenharGraficosHTML(contas, somaTotal);


//   document.getElementById('resumo-qtd').textContent = contas.length;
//   document.getElementById('resumo-total').textContent = 'R$ ' + somaTotal.toFixed(2);

//   const tbody = document.getElementById('tabela-contas');
//   if (contas.length === 0) {
//     tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#666;">Nenhuma conta encontrada.</td></tr>';
//     return;
//   }

//   tbody.innerHTML = contas.map(function (c) {
//     return '<tr>' +
//       '<td>' + c.codigo + '</td>' +
//       '<td>' + c.nome + '</td>' +
//       '<td><strong>R$ ' + Number(c.saldo).toFixed(2) + '</strong></td>' +
//       '<td>' +
//       '<input id="val-' + c.codigo + '" type="number" step="0.01" placeholder="R$" style="width: 75px;"> ' +
//       '<button onclick="movimentarLivre(' + c.codigo + ', 1)">Depositar</button> ' +
//       '<button class="btn-saque" onclick="movimentarLivre(' + c.codigo + ', -1)">Sacar</button>' +
//       '</td>' +
//       '<td>' +
//       '<button onclick="verExtrato(' + c.codigo + ', \'' + c.nome + '\')">Extrato</button> ' +
//       '<button class="btn-excluir" onclick="deletarConta(' + c.codigo + ', \'' + c.nome + '\')">Excluir</button>' +
//       '</td>' +
//       '</tr>';
//   }).join('');
// };


window.carregarContas = async function(exibirMsgFiltro) {
  const campoBusca = document.getElementById('campo-busca');
  const busca = campoBusca ? campoBusca.value : '';
  const res = await apiFetch('/contas?busca=' + encodeURIComponent(busca));
  if (!res.ok) return;
  const contas = await res.json();

  if (exibirMsgFiltro) {
    exibirAviso(busca ? 'Filtro aplicado: ' + contas.length + ' conta(s) encontrada(s).' : 'Filtro limpo!');
  }

  const somaTotal = contas.reduce(function(acc, c) { return acc + Number(c.saldo); }, 0);
  document.getElementById('resumo-qtd').textContent = contas.length;
  document.getElementById('resumo-total').textContent = 'R$ ' + somaTotal.toFixed(2);
  desenharGraficosHTML(contas, somaTotal);

  const tbody = document.getElementById('tabela-contas');
  tbody.innerHTML = '';

  if (contas.length === 0) {
    const tr = document.createElement('tr');
    const td = tr.insertCell();
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.color = '#666';
    td.textContent = 'Nenhuma conta encontrada.';
    tbody.appendChild(tr);
    return;
  }

  const ehConsulta = (sessionStorage.getItem('perfil') === 'consulta');

  contas.forEach(function(c) {
    const tr = document.createElement('tr');

    tr.insertCell().textContent = c.codigo;
    tr.insertCell().textContent = c.nome;

    const tdSaldo = tr.insertCell();
    tdSaldo.style.fontWeight = 'bold';
    tdSaldo.textContent = 'R$ ' + Number(c.saldo).toFixed(2);

    // Coluna Movimentar (Input + Depositar + Sacar)
    const tdMov = tr.insertCell();
    const inputVal = document.createElement('input');
    inputVal.id = 'val-' + c.codigo;
    inputVal.type = 'number';
    inputVal.step = '0.01';
    inputVal.placeholder = 'R$';
    inputVal.style.width = '75px';
    if (ehConsulta) {
      inputVal.disabled = true;
      inputVal.style.opacity = '0.45';
      inputVal.style.cursor = 'not-allowed';
    }

    const btnDep = document.createElement('button');
    btnDep.textContent = 'Depositar';
    if (ehConsulta) {
      btnDep.disabled = true;
      btnDep.style.opacity = '0.45';
      btnDep.style.cursor = 'not-allowed';
    } else {
      btnDep.onclick = function() { movimentarLivre(c.codigo, 1); };
    }

    const btnSac = document.createElement('button');
    btnSac.className = 'btn-saque';
    btnSac.textContent = 'Sacar';
    if (ehConsulta) {
      btnSac.disabled = true;
      btnSac.style.opacity = '0.45';
      btnSac.style.cursor = 'not-allowed';
    } else {
      btnSac.onclick = function() { movimentarLivre(c.codigo, -1); };
    }

    tdMov.appendChild(inputVal);
    tdMov.appendChild(document.createTextNode(' '));
    tdMov.appendChild(btnDep);
    tdMov.appendChild(document.createTextNode(' '));
    tdMov.appendChild(btnSac);

    // Coluna Opções (Extrato + Excluir)
    const tdOp = tr.insertCell();
    const btnExt = document.createElement('button');
    btnExt.textContent = 'Extrato';
    btnExt.onclick = function() { verExtrato(c.codigo, c.nome); };

    const btnExc = document.createElement('button');
    btnExc.className = 'btn-excluir';
    btnExc.textContent = 'Excluir';
    if (ehConsulta) {
      btnExc.disabled = true;
      btnExc.style.opacity = '0.45';
      btnExc.style.cursor = 'not-allowed';
    } else {
      btnExc.onclick = function() { deletarConta(c.codigo, c.nome); };
    }

    tdOp.appendChild(btnExt);
    tdOp.appendChild(document.createTextNode(' '));
    tdOp.appendChild(btnExc);

    tbody.appendChild(tr);
  });
};




window.limparFiltro = function () {
  document.getElementById('campo-busca').value = '';
  carregarContas(true);
};

window.criarConta = async function () {
  const nome = document.getElementById('nome').value;
  const saldo = document.getElementById('saldo').value;
  const res = await apiFetch('/contas', {
    method: 'POST',
    body: JSON.stringify({ nome: nome, saldo: saldo })
  });
  const dados = await res.json();
  if (!res.ok) return exibirAviso(dados.erro, true);

  document.getElementById('nome').value = '';
  document.getElementById('saldo').value = '';
  exibirAviso('Nova conta cadastrada (' + dados.codigo + ')');
  carregarContas();
};

window.movimentarLivre = async function (codigo, multiplicador) {
  const campo = document.getElementById('val-' + codigo);
  const valorDigitado = parseFloat(campo.value);
  if (isNaN(valorDigitado) || valorDigitado <= 0) {
    return exibirAviso('Digite um valor positivo maior que zero.', true);
  }

  const res = await apiFetch('/contas/' + codigo + '/movimentar', {
    method: 'PATCH',
    body: JSON.stringify({ valor: valorDigitado * multiplicador })
  });
  const dados = await res.json();
  if (!res.ok) return exibirAviso(dados.erro, true);

  const valorFormatado = valorDigitado.toFixed(2).replace('.', ',');
  if (multiplicador > 0) {
    exibirAviso('Depósito de R$ ' + valorFormatado + ' realizado com sucesso!');
  } else {
    exibirAviso('Saque no valor de R$ ' + valorFormatado + ' realizado com sucesso!');
  }
  carregarContas();
};

window.realizarTransferencia = async function () {
  const origem = document.getElementById('origem').value;
  const destino = document.getElementById('destino').value;
  const valor = parseFloat(document.getElementById('valor-transf').value);

  const res = await apiFetch('/transferir', {
    method: 'POST',
    body: JSON.stringify({ origem: origem, destino: destino, valor: valor })
  });
  const dados = await res.json();
  if (!res.ok) return exibirAviso(dados.erro, true);

  document.getElementById('origem').value = '';
  document.getElementById('destino').value = '';
  document.getElementById('valor-transf').value = '';
  const valorFormatado = valor.toFixed(2).replace('.', ',');
  exibirAviso('Transferencia realizada com sucesso no valor de R$ ' + valorFormatado + '!');
  carregarContas();
};

window.deletarConta = async function (codigo, nome) {
  if (!confirm('Tem certeza que deseja excluir a conta de ' + nome + ' (Cód. ' + codigo + ')?')) return;

  const res = await apiFetch('/contas/' + codigo, { method: 'DELETE' });
  const dados = await res.json();
  if (!res.ok) return exibirAviso(dados.erro, true);

  document.getElementById('box-extrato').style.display = 'none';
  exibirAviso('Conta ' + codigo + ', ' + nome + ' excluida com sucesso!');
  carregarContas();
};

window.verExtrato = async function (codigo, nome) {
  const res = await apiFetch('/contas/' + codigo + '/extrato');
  if (!res.ok) {
    const dados = await res.json().catch(function () { return {}; });
    return exibirAviso(dados.erro || 'Erro ao consultar extrato.', true);
  }
  const itens = await res.json();
  contaExtratoAtual = codigo;

  document.getElementById('box-extrato').style.display = 'block';
  document.getElementById('titulo-extrato').textContent = 'Extrato - ' + nome + ' (Cód. ' + codigo + ')';
  document.getElementById('tabela-extrato').innerHTML = itens.map(function (i) {
    return '<tr><td>' + i.data_hora + '</td><td>' + i.tipo + '</td><td>R$ ' + Number(i.valor).toFixed(2) + '</td></tr>';
  }).join('');

  exibirAviso('Consulte o extrato!');
};

window.baixarArquivoExtrato = async function (formato) {
  if (!contaExtratoAtual) return;
  const token = sessionStorage.getItem('token');
  const url = '/contas/' + contaExtratoAtual + '/extrato/' + formato + '?token=' + token;

  const res = await fetch(url);
  if (!res.ok) {
    return exibirAviso('Erro ao baixar ' + formato.toUpperCase() + '.', true);
  }


  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'extrato_conta_' + contaExtratoAtual + '.' + formato;
  link.click();
  exibirAviso(formato === 'csv' ? 'CSV Baixado!' : 'PDF Baixado!');
};

// Gestão de Usuários (Alinhado por células DOM)
window.carregarUsuarios = async function () {
  const res = await apiFetch('/usuarios');
  if (!res.ok) return;
  const lista = await res.json();

  const tbody = document.getElementById('tabela-usuarios');
  tbody.innerHTML = '';

  lista.forEach(function (u) {
    const tr = document.createElement('tr');

    tr.insertCell().textContent = u.id;

    const tdUser = tr.insertCell();
    tdUser.style.fontWeight = 'bold';
    tdUser.textContent = u.usuario;

    tr.insertCell().textContent = u.perfil;
    tr.insertCell().textContent = u.ultimo_acesso || 'Nunca acessou';

    const tdAtivo = tr.insertCell();
    tdAtivo.style.fontWeight = 'bold';
    tdAtivo.style.color = (u.ativo === 'Sim') ? '#15803d' : '#dc2626';
    tdAtivo.textContent = u.ativo;

    const tdAcoes = tr.insertCell();
    const btnExcluir = document.createElement('button');
    btnExcluir.className = 'btn-excluir';
    btnExcluir.textContent = 'Excluir';
    btnExcluir.onclick = function () {
      removerUsuario(u.id, u.usuario);
    };
    tdAcoes.appendChild(btnExcluir);

    tbody.appendChild(tr);
  });
};


// Consulta de Logs de Auditoria (Alinhado por células DOM) - paginacao
let paginaAtualLogs = 1;
let totalPaginasLogs = 1;

window.mudarPaginaLogs = function (delta) {
  const novaPagina = paginaAtualLogs + delta;
  if (novaPagina >= 1 && novaPagina <= totalPaginasLogs) {
    carregarLogs(false, novaPagina);
  }
};

window.carregarLogs = async function (exibirMsg, pagina) {
  if (pagina) paginaAtualLogs = pagina;

  const dataInicio = document.getElementById('log-data-inicio').value;
  const dataFim = document.getElementById('log-data-fim').value;
  const usuario = document.getElementById('log-usuario').value;
  const limite = document.getElementById('log-limite').value;

  const query = '?dataInicio=' + encodeURIComponent(dataInicio) +
    '&dataFim=' + encodeURIComponent(dataFim) +
    '&usuario=' + encodeURIComponent(usuario) +
    '&pagina=' + paginaAtualLogs +
    '&limite=' + limite;

  const res = await apiFetch('/logs' + query);
  if (!res.ok) return;
  const dados = await res.json();

  const logs = dados.registros || [];
  paginaAtualLogs = dados.paginaAtual || 1;
  totalPaginasLogs = dados.totalPaginas || 1;

  if (exibirMsg) {
    exibirAviso('Consulta de logs realizada: ' + dados.totalRegistros + ' registro(s) encontrado(s).');
  }

  // Atualiza textos e estado dos botões de paginação
  document.getElementById('info-paginacao-logs').textContent =
    'Página ' + paginaAtualLogs + ' de ' + totalPaginasLogs + ' (' + dados.totalRegistros + ' registros)';

  const btnAnt = document.getElementById('btn-log-anterior');
  const btnProx = document.getElementById('btn-log-proxima');
  btnAnt.disabled = (paginaAtualLogs <= 1);
  btnProx.disabled = (paginaAtualLogs >= totalPaginasLogs);
  btnAnt.style.opacity = btnAnt.disabled ? '0.5' : '1';
  btnProx.style.opacity = btnProx.disabled ? '0.5' : '1';

  const tbody = document.getElementById('tabela-logs');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    const tr = document.createElement('tr');
    const td = tr.insertCell();
    td.colSpan = 5;
    td.style.textAlign = 'center';
    td.style.color = '#666';
    td.textContent = 'Nenhum registro de log encontrado.';
    tbody.appendChild(tr);
    return;
  }

  logs.forEach(function (l) {
    const tr = document.createElement('tr');

    const tdData = tr.insertCell();
    tdData.style.whiteSpace = 'nowrap';
    tdData.textContent = l.data_hora_fmt;

    tr.insertCell().textContent = l.usuario_id || '-';

    const tdUser = tr.insertCell();
    tdUser.style.fontWeight = 'bold';
    tdUser.textContent = l.usuario_nome;

    tr.insertCell().textContent = l.funcao;
    tr.insertCell().textContent = l.descricao;

    tbody.appendChild(tr);
  });
};

window.limparFiltroLogs = function () {
  document.getElementById('log-data-inicio').value = '';
  document.getElementById('log-data-fim').value = '';
  document.getElementById('log-usuario').value = '';
  carregarLogs(true, 1);
};


window.exportarUsuariosCSV = async function () {
  const token = sessionStorage.getItem('token');
  const res = await fetch('/usuarios/csv?token=' + token);
  if (!res.ok) return exibirAviso('Erro ao exportar usuários.', true);

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'usuarios_sistema.csv';
  link.click();

  exibirAviso('CSV de Usuários Baixado!');
};

window.exportarLogsCSV = async function () {
  const token = sessionStorage.getItem('token');
  const dataInicio = document.getElementById('log-data-inicio').value;
  const dataFim = document.getElementById('log-data-fim').value;
  const usuario = document.getElementById('log-usuario').value;

  const query = '?token=' + token +
    '&dataInicio=' + encodeURIComponent(dataInicio) +
    '&dataFim=' + encodeURIComponent(dataFim) +
    '&usuario=' + encodeURIComponent(usuario);

  const res = await fetch('/logs/csv' + query);
  if (!res.ok) return exibirAviso('Erro ao exportar logs.', true);

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'logs_auditoria.csv';
  link.click();

  exibirAviso('CSV de Logs Baixado!');
};




window.abrirRecuperacaoSenha = function () {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-recuperar').style.display = 'block';
  document.getElementById('etapa-1-usuario').style.display = 'block';
  document.getElementById('etapa-2-resposta').style.display = 'none';
  document.getElementById('msg-recuperar').textContent = '';
  document.getElementById('rec-usuario').value = document.getElementById('login-usuario').value;
};

window.voltarParaLogin = function (mensagemSucesso) {
  document.getElementById('tela-recuperar').style.display = 'none';
  document.getElementById('tela-login').style.display = 'block';
  const msgLogin = document.getElementById('msg-login');
  if (mensagemSucesso) {
    msgLogin.className = 'sucesso';
    msgLogin.textContent = mensagemSucesso;
  } else {
    msgLogin.textContent = '';
  }
};

window.consultarPerguntaSecreta = async function () {
  const usuario = document.getElementById('rec-usuario').value.trim();
  const msgRec = document.getElementById('msg-recuperar');
  msgRec.textContent = '';

  const res = await fetch('/recuperar-senha/pergunta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: usuario })
  });
  const dados = await res.json();

  if (!res.ok) {
    msgRec.className = 'erro';
    msgRec.textContent = dados.erro;
    return;
  }

  document.getElementById('texto-pergunta-secreta').textContent = 'Pergunta: ' + dados.perguntaSecreta;
  document.getElementById('etapa-1-usuario').style.display = 'none';
  document.getElementById('etapa-2-resposta').style.display = 'block';
};

window.confirmarRedefinicaoSenha = async function () {
  const usuario = document.getElementById('rec-usuario').value.trim();
  const resposta = document.getElementById('rec-resposta').value;
  const novaSenha = document.getElementById('rec-nova-senha').value;
  const msgRec = document.getElementById('msg-recuperar');

  const res = await fetch('/recuperar-senha/redefinir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: usuario, resposta: resposta, novaSenha: novaSenha })
  });
  const dados = await res.json();

  if (!res.ok) {
    msgRec.className = 'erro';
    msgRec.textContent = dados.erro;
    return;
  }

  document.getElementById('rec-resposta').value = '';
  document.getElementById('rec-nova-senha').value = '';
  voltarParaLogin(dados.mensagem);
};



window.cadastrarOuAtualizarUsuario = async function () {
  const usuario = document.getElementById('novo-user').value;
  const senha = document.getElementById('nova-senha').value;
  const perfil = document.getElementById('novo-perfil').value;
  const perguntaSecreta = document.getElementById('nova-pergunta').value;
  const respostaSecreta = document.getElementById('nova-resposta').value;

  const res = await apiFetch('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      usuario: usuario,
      senha: senha,
      perfil: perfil,
      perguntaSecreta: perguntaSecreta,
      respostaSecreta: respostaSecreta
    })
  });
  const dados = await res.json();
  if (!res.ok) return exibirAviso(dados.erro, true);

  document.getElementById('novo-user').value = '';
  document.getElementById('nova-senha').value = '';
  document.getElementById('nova-pergunta').value = '';
  document.getElementById('nova-resposta').value = '';
  exibirAviso(dados.mensagem);
  carregarUsuarios();
};


let chartSaldos = null;
let chartMovimentacoes = null;

// função alternarResumo 
window.alternarResumo = function() {
  const marcado = document.getElementById('check-exibir-resumo').checked;
  const box = document.getElementById('box-resumo');
  if (box) {
    box.style.display = marcado ? 'grid' : 'none';
  }
  if (marcado) {
    carregarContas();
  }
};




// checkbox Mostrar Gráficos de Saldos e Distribuição
window.alternarGraficos = function() {
  const marcado = document.getElementById('check-exibir-graficos').checked;
  const box = document.getElementById('box-graficos');
  if (box) {
    box.style.display = marcado ? 'grid' : 'none';
  }
  if (marcado) {
    carregarContas();
  }
};




window.desenharGraficosHTML = function(contas, somaTotal) {
  const boxSaldos = document.getElementById('grafico-saldos-html');
  const boxPerc = document.getElementById('grafico-percentual-html');
  if (!boxSaldos || !boxPerc) return;

  boxSaldos.innerHTML = '';
  boxPerc.innerHTML = '';

  if (!contas || contas.length === 0) {
    boxSaldos.textContent = 'Sem dados para exibir.';
    boxPerc.textContent = 'Sem dados para exibir.';
    return;
  }

  // Ordena do maior saldo para o menor (Top 6)
  const ordenadas = contas.slice().sort(function(a, b) {
    return Number(b.saldo) - Number(a.saldo);
  }).slice(0, 6);

  const maiorSaldo = Math.max.apply(null, ordenadas.map(function(c) { return Number(c.saldo); })) || 1;
  const cores = ['#0284c7', '#16a34a', '#d97706', '#7c3aed', '#0d9488', '#dc2626'];

  ordenadas.forEach(function(c, idx) {
    const saldo = Number(c.saldo);
    const cor = cores[idx % cores.length];

    // --- 1. Barra proporcional ao maior saldo (R$) ---
    const larguraSaldo = Math.max(4, Math.round((saldo / maiorSaldo) * 100));
    const item1 = document.createElement('div');
    item1.style.marginBottom = '10px';

    const topo1 = document.createElement('div');
    topo1.style.display = 'flex';
    topo1.style.justifyContent = 'space-between';
    topo1.style.fontSize = '13px';
    topo1.style.marginBottom = '3px';
    topo1.textContent = c.nome + ' — R$ ' + saldo.toFixed(2);

    const trilho1 = document.createElement('div');
    trilho1.style.background = '#e2e8f0';
    trilho1.style.borderRadius = '4px';
    trilho1.style.height = '12px';

    const barra1 = document.createElement('div');
    barra1.style.background = cor;
    barra1.style.width = larguraSaldo + '%';
    barra1.style.height = '12px';
    barra1.style.borderRadius = '4px';
    barra1.style.transition = 'width 0.4s';

    trilho1.appendChild(barra1);
    item1.appendChild(topo1);
    item1.appendChild(trilho1);
    boxSaldos.appendChild(item1);

    // --- 2. Barra de participação percentual no total (%) ---
    const perc = somaTotal > 0 ? ((saldo / somaTotal) * 100) : 0;
    const item2 = document.createElement('div');
    item2.style.marginBottom = '10px';

    const topo2 = document.createElement('div');
    topo2.style.display = 'flex';
    topo2.style.justifyContent = 'space-between';
    topo2.style.fontSize = '13px';
    topo2.style.marginBottom = '3px';
    topo2.textContent = c.nome + ' — ' + perc.toFixed(1) + '%';

    const trilho2 = document.createElement('div');
    trilho2.style.background = '#e2e8f0';
    trilho2.style.borderRadius = '4px';
    trilho2.style.height = '12px';

    const barra2 = document.createElement('div');
    barra2.style.background = cor;
    barra2.style.width = Math.max(2, Math.round(perc)) + '%';
    barra2.style.height = '12px';
    barra2.style.borderRadius = '4px';
    barra2.style.transition = 'width 0.4s';

    trilho2.appendChild(barra2);
    item2.appendChild(topo2);
    item2.appendChild(trilho2);
    boxPerc.appendChild(item2);
  });
};




atualizarTela();

