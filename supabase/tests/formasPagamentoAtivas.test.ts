/** @jest-environment node */
// Testes da migration 20261018000100_formas_pagamento_ativas.sql — EIX-39 (US06-b).
// O Gestor de Frota escolhe a forma de pagamento da manutenção sem ganhar leitura da tabela
// `forma_pagamento`: a RPC devolve só id e nome das ativas, e a policy da tabela não muda.

import { criarBanco, comoAnonimo, comoUsuario, type Banco, type PerfilNome, type StatusUsuario } from './helpers/db';

// Ordem alfabética das formas semeadas em 20260924000200_catalogos.sql. A semente as insere
// como Boleto, Pix, TED, Cartão Corporativo: só um `order by nome` devolve nesta ordem.
const ATIVAS_EM_ORDEM = ['Boleto', 'Cartão Corporativo', 'Pix', 'TED'];

// O erro do PGlite traz o SQLSTATE em `code`.
async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration formas_pagamento_ativas', () => {
  let db: Banco;
  let idsPorNome: Record<string, string>;

  beforeAll(async () => {
    db = await criarBanco();
    // Forma inativa: existe na tabela, mas não pode chegar ao seletor (MAN-28).
    await db.query(`insert into forma_pagamento (nome, ativa) values ('Cheque', false)`);

    const formas = await db.query<{ id: string; nome: string }>('select id, nome from forma_pagamento');
    idsPorNome = Object.fromEntries(formas.rows.map((forma) => [forma.nome, forma.id]));
  });

  function chamar(usuario: { id: string; perfil: PerfilNome; status?: StatusUsuario }) {
    return comoUsuario(db, usuario, (tx) =>
      tx.query<Record<string, unknown>>('select * from listar_formas_pagamento_ativas()'),
    );
  }

  // MAN-28
  it.each([
    ['Admin', '39100000-0000-0000-0000-000000000001'],
    ['Financeiro', '39100000-0000-0000-0000-000000000002'],
    ['Gestor de Frota', '39100000-0000-0000-0000-000000000003'],
  ] as [PerfilNome, string][])(
    '%s recebe só id e nome das formas ativas, ordenadas por nome',
    async (perfil, id) => {
      const resultado = await chamar({ id, perfil });

      // toEqual com objetos de duas chaves: qualquer coluna a mais (ativa, datas) falha.
      expect(resultado.rows).toEqual(ATIVAS_EM_ORDEM.map((nome) => ({ id: idsPorNome[nome], nome })));
    },
  );

  // MAN-29
  it('Motorista recebe 42501', async () => {
    const codigo = await codigoDoErro(chamar({ id: '39100000-0000-0000-0000-000000000011', perfil: 'Motorista' }));

    expect(codigo).toBe('42501');
  });

  it.each([
    ['Bloqueado', '39100000-0000-0000-0000-000000000021'],
    ['AguardandoAprovacao', '39100000-0000-0000-0000-000000000022'],
  ] as [StatusUsuario, string][])('Gestor de Frota com status %s recebe 42501', async (status, id) => {
    const codigo = await codigoDoErro(chamar({ id, perfil: 'Gestor de Frota', status }));

    expect(codigo).toBe('42501');
  });

  it('anon recebe 42501', async () => {
    const codigo = await codigoDoErro(
      comoAnonimo(db, (tx) => tx.query('select * from listar_formas_pagamento_ativas()')),
    );

    expect(codigo).toBe('42501');
  });

  // MAN-30, conferido direto no catálogo (lição L-006): a checagem de perfil sozinha faria o anon
  // receber 42501 mesmo sem o revoke.
  it('anon não tem execute na função; authenticated tem', async () => {
    const privilegios = await db.query<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', 'listar_formas_pagamento_ativas()', 'execute') as anon,
              has_function_privilege('authenticated', 'listar_formas_pagamento_ativas()', 'execute') as authenticated`,
    );

    expect(privilegios.rows).toEqual([{ anon: false, authenticated: true }]);
  });

  // MAN-31: a RPC não abre a tabela. O select direto do Gestor continua barrado pelo RLS.
  it('Gestor de Frota continua sem ler forma_pagamento direto pela tabela', async () => {
    const direto = await comoUsuario(
      db,
      { id: '39100000-0000-0000-0000-000000000003', perfil: 'Gestor de Frota' },
      (tx) => tx.query('select id from forma_pagamento'),
    );

    expect(direto.rows).toEqual([]);
  });
});
