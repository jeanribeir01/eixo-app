/** @jest-environment node */
// Matriz de acesso por perfil da EIX-32 (US18) — spec .specs/features/eix32-rls/spec.md.
// Cada teste chama o banco como o PostgREST chama (role `authenticated` + `auth.uid()`),
// sem passar pela UI: é a prova de que esconder a tela (US17) não é a única barreira.
//
// O que já tinha prova antes desta task continua nos arquivos de origem e não é repetido
// aqui: Motorista sem financeiro e só as próprias viagens (rls.test.ts), RPCs recusando
// perfil (divida.test.ts DIV-06, resumo_caixa.test.ts SALDO-06).

import { comoUsuario, criarBanco, type Banco, type StatusUsuario } from './helpers/db';

const NAO_APROVADOS: [StatusUsuario, string][] = [
  ['AguardandoAprovacao', '32000000-0000-0000-0001-000000000001'],
  ['Bloqueado', '32000000-0000-0000-0001-000000000002'],
];

describe('EIX-32: RLS por perfil', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('perfil', () => {
    it.each(NAO_APROVADOS)('%s lê só a linha do próprio perfil (RLS-12)', async (status, id) => {
      // Financeiro, e não o Motorista padrão, para provar que a linha vem do perfil_id do
      // próprio usuário e não de um "Motorista" fixo.
      await comoUsuario(db, { id, perfil: 'Financeiro', status }, async (tx) => {
        const perfis = await tx.query<{ nome: string }>('select nome from perfil');

        expect(perfis.rows.map((linha) => linha.nome)).toEqual(['Financeiro']);
      });
    });

    it('usuário Ativo lê os 4 perfis (RLS-13)', async () => {
      await comoUsuario(db, { id: '32000000-0000-0000-0002-000000000001', perfil: 'Motorista' }, async (tx) => {
        const perfis = await tx.query<{ nome: string }>('select nome from perfil');

        expect(perfis.rows.map((linha) => linha.nome).sort()).toEqual(['Admin', 'Financeiro', 'Gestor de Frota', 'Motorista']);
      });
    });
  });
});
