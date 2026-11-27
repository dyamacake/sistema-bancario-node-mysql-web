// Testes Automatizados (banco.test.js)

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import pool from './db.js';
import {
  cadastrarConta,
  movimentarSaldo,
  transferir,
  excluirConta,
  listarExtrato
} from './bancoService.js';

describe('Regras de Negócio MySQL - Conta Corrente', () => {
  let contaA;
  let contaB;

  it('deve cadastrar duas contas válidas com saldo inicial', async () => {
    contaA = await cadastrarConta('Teste MySQL A', 1000);
    contaB = await cadastrarConta('Teste MySQL B', 200);

    assert.equal(contaA.saldo, 1000);
    assert.equal(contaB.saldo, 200);
  });

  it('deve bloquear saque maior que o saldo disponível', async () => {
    await assert.rejects(async () => {
      await movimentarSaldo(contaA.codigo, -1500);
    }, /Saldo insuficiente/);
  });

  it('deve realizar transferência entre contas e registrar no extrato', async () => {
    await transferir(contaA.codigo, contaB.codigo, 300);

    const extratoA = await listarExtrato(contaA.codigo);
    const extratoB = await listarExtrato(contaB.codigo);

    assert.equal(extratoA.length, 2);
    assert.equal(extratoB.length, 2);
  });

  after(async () => {
    if (contaA) await excluirConta(contaA.codigo);
    if (contaB) await excluirConta(contaB.codigo);
    await pool.end();
  });
});
