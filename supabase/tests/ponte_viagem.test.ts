/** @jest-environment node */
// Testes da migration 20261111000100_ponte_viagem.sql — EIX-42 (US09).
// Litros no lançamento de Combustível (regra que a US10 usa no KM/L) e as RPCs que mostram ao
// Financeiro as viagens que ele pode vincular, sem abrir a tabela `viagem`.

import {
  aplicarMigration,
  comoAnonimo,
  comoSuperuser,
  comoUsuario,
  criarBanco,
  type Banco,
  type PerfilNome,
  type StatusUsuario,
} from './helpers/db';

const ADMIN = { id: '42100000-0000-0000-0000-000000000001', perfil: 'Admin' as const };
const FINANCEIRO = { id: '42100000-0000-0000-0000-000000000002', perfil: 'Financeiro' as const };
const GESTOR = { id: '42100000-0000-0000-0000-000000000003', perfil: 'Gestor de Frota' as const };
const MOTORISTA = { id: '42100000-0000-0000-0000-000000000004', perfil: 'Motorista' as const };

const COLUNAS_DA_RPC = [
  'cidade_destino',
  'cidade_origem',
  'data_fim',
  'data_inicio',
  'id',
  'placa',
  'status',
  'uf_destino',
  'uf_origem',
];

// O erro do PGlite traz o SQLSTATE em `code`.
async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration ponte_viagem', () => {
  let db: Banco;
  let rotaId: string;
  let formaId: string;
  let categoria: { combustivel: string; frete: string; pedagio: string };
  const viagem = { andamento: '', recente: '', semFim: '', limite29: '', limite31: '', antiga: '', cancelada: '' };
  let placas = 0;

  async function criarVeiculo() {
    placas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga) values ($1, 'Volvo', 'FH', 10000) returning id`,
      [`PTE${String(placas).padStart(4, '0')}`],
    );
    return resultado.rows[0]!.id;
  }

  // Grava como superuser: o RLS fica fora, e cada viagem tem veículo próprio (VG001).
  async function criarViagem(dados: {
    status: 'EmAndamento' | 'Finalizada' | 'Cancelada';
    inicioHaDias: number;
    fimHaDias: number | null;
  }) {
    const veiculoId = await criarVeiculo();
    const resultado = await db.query<{ id: string }>(
      `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, status, data_inicio, data_fim)
       values ($1, $2, $3, 1000, $4, $5, now() - make_interval(days => $6),
               case when $7::int is null then null else now() - make_interval(days => $7::int) end)
       returning id`,
      [
        veiculoId,
        rotaId,
        MOTORISTA.id,
        dados.status === 'Finalizada' ? 1500 : null,
        dados.status,
        dados.inicioHaDias,
        dados.fimHaDias,
      ],
    );
    return resultado.rows[0]!.id;
  }

  function inserirLancamento(dados: { categoriaId: string; viagemId?: string | null; litros?: number | null }) {
    return db.query<{ id: string; litros: string | null }>(
      `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, viagem_id, litros)
       values ($1, $2, 100, 'Teste', $3, $4) returning id, litros::text`,
      [dados.categoriaId, formaId, dados.viagemId ?? null, dados.litros ?? null],
    );
  }

  beforeAll(async () => {
    // O Supabase concede `execute` em toda função nova a anon e authenticated (privilégio padrão do
    // schema public); o stub do PGlite não. Sem imitar isso aqui, o teste de ACESSO-04 passaria mesmo
    // sem o `revoke ... from anon` da migration.
    db = await criarBanco({ antesDe: '20261111000100_ponte_viagem.sql' });
    await db.exec('alter default privileges in schema public grant execute on functions to anon, authenticated');
    await aplicarMigration(db, '20261111000100_ponte_viagem.sql');
    for (const usuario of [ADMIN, FINANCEIRO, GESTOR, MOTORISTA]) {
      await comoUsuario(db, usuario, async () => {});
    }

    const rota = await db.query<{ id: string }>(
      `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
       values ('São Paulo', 'SP', 'Curitiba', 'PR', 400) returning id`,
    );
    rotaId = rota.rows[0]!.id;

    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix'`);
    formaId = forma.rows[0]!.id;

    const categorias = await db.query<{ id: string; titulo: string }>(
      `select id, titulo from categoria where titulo in ('Combustível', 'Frete', 'Pedágio')`,
    );
    const porTitulo = Object.fromEntries(categorias.rows.map((linha) => [linha.titulo, linha.id]));
    categoria = { combustivel: porTitulo['Combustível']!, frete: porTitulo['Frete']!, pedagio: porTitulo['Pedágio']! };

    // A em andamento começou antes das concluídas: só a regra "em andamento primeiro" a põe no
    // topo; ordenar só pela data de início a deixaria no fim.
    viagem.andamento = await criarViagem({ status: 'EmAndamento', inicioHaDias: 35, fimHaDias: null });
    viagem.recente = await criarViagem({ status: 'Finalizada', inicioHaDias: 6, fimHaDias: 5 });
    // Finalizada sem data_fim: vale a última atualização, que é agora.
    viagem.semFim = await criarViagem({ status: 'Finalizada', inicioHaDias: 4, fimHaDias: null });
    // Limite da janela de 30 dias: 29 entra, 31 fica de fora.
    viagem.limite29 = await criarViagem({ status: 'Finalizada', inicioHaDias: 30, fimHaDias: 29 });
    viagem.limite31 = await criarViagem({ status: 'Finalizada', inicioHaDias: 32, fimHaDias: 31 });
    viagem.antiga = await criarViagem({ status: 'Finalizada', inicioHaDias: 41, fimHaDias: 40 });
    viagem.cancelada = await criarViagem({ status: 'Cancelada', inicioHaDias: 1, fimHaDias: null });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('litros', () => {
    // LITROS-06
    it.each([0, -1])('litros = %s é recusado com 23514', async (litros) => {
      expect(await codigoDoErro(inserirLancamento({ categoriaId: categoria.combustivel, litros }))).toBe('23514');
    });

    // LITROS-05
    it.each(['frete', 'pedagio'] as const)('litros em %s é recusado com 23514', async (nome) => {
      expect(await codigoDoErro(inserirLancamento({ categoriaId: categoria[nome], litros: 10 }))).toBe('23514');
    });

    // LITROS-05
    it('Combustível vinculado a viagem sem litros é recusado com 23514', async () => {
      const codigo = await codigoDoErro(inserirLancamento({ categoriaId: categoria.combustivel, viagemId: viagem.andamento }));

      expect(codigo).toBe('23514');
    });

    // LITROS-05 pelo update: vincular depois um Combustível que não tem litros.
    it('vincular por update um Combustível sem litros é recusado com 23514', async () => {
      const criado = await inserirLancamento({ categoriaId: categoria.combustivel });

      const codigo = await codigoDoErro(
        db.query('update movimentacao set viagem_id = $2 where id = $1', [criado.rows[0]!.id, viagem.andamento]),
      );

      expect(codigo).toBe('23514');
    });

    it('Combustível vinculado com litros grava os litros com duas casas', async () => {
      const criado = await inserirLancamento({
        categoriaId: categoria.combustivel,
        viagemId: viagem.andamento,
        litros: 412.37,
      });

      expect(criado.rows[0]!.litros).toBe('412.37');
    });

    // Assumption da spec: Combustível sem viagem deixa os litros opcionais.
    it('Combustível sem viagem e sem litros é aceito', async () => {
      const criado = await inserirLancamento({ categoriaId: categoria.combustivel });

      expect(criado.rows[0]!.litros).toBeNull();
    });

    // PONTE-04 no banco: Frete e Pedágio vinculam sem litros.
    it.each(['frete', 'pedagio'] as const)('%s vinculado sem litros é aceito', async (nome) => {
      const criado = await inserirLancamento({ categoriaId: categoria[nome], viagemId: viagem.andamento });

      expect(criado.rows).toHaveLength(1);
    });

    // A função do trigger tem execute revogado de authenticated; o trigger tem que valer mesmo assim.
    it('Financeiro grava Combustível vinculado com litros pela API', async () => {
      const resultado = await comoUsuario(db, FINANCEIRO, (tx) =>
        tx.query<{ litros: string }>(
          `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, viagem_id, litros)
           values ($1, $2, 250, 'Diesel', $3, 80.5) returning litros::text`,
          [categoria.combustivel, formaId, viagem.recente],
        ),
      );

      expect(resultado.rows).toEqual([{ litros: '80.50' }]);
    });

    it('Financeiro recebe 23514 ao vincular Combustível sem litros pela API', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, FINANCEIRO, (tx) =>
          tx.query(
            `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, viagem_id)
             values ($1, $2, 250, 'Diesel', $3)`,
            [categoria.combustivel, formaId, viagem.recente],
          ),
        ),
      );

      expect(codigo).toBe('23514');
    });
  });

  describe('listar_viagens_vinculaveis', () => {
    function listar(usuario: { id: string; perfil: PerfilNome; status?: StatusUsuario }) {
      return comoUsuario(db, usuario, (tx) =>
        tx.query<Record<string, unknown>>('select * from listar_viagens_vinculaveis()'),
      );
    }

    // ACESSO-01, PONTE-02: em andamento primeiro; concluídas dos últimos 30 dias pela data de
    // início mais recente; fora as concluídas de 31 e 40 dias atrás e a cancelada.
    it.each([ADMIN, FINANCEIRO])('$perfil recebe as viagens vinculáveis na ordem da spec', async (usuario) => {
      const resultado = await listar(usuario);

      expect(resultado.rows.map((linha) => linha.id)).toEqual([
        viagem.andamento,
        viagem.semFim,
        viagem.recente,
        viagem.limite29,
      ]);
    });

    // ACESSO-01: só as colunas da spec (nada de hodômetro nem motorista).
    it('devolve placa, rota, status e datas, e só essas colunas', async () => {
      const resultado = await listar(FINANCEIRO);
      const andamento = resultado.rows.find((linha) => linha.id === viagem.andamento)!;

      expect(Object.keys(andamento).sort()).toEqual(COLUNAS_DA_RPC);
      expect(andamento).toMatchObject({
        placa: 'PTE0001',
        cidade_origem: 'São Paulo',
        uf_origem: 'SP',
        cidade_destino: 'Curitiba',
        uf_destino: 'PR',
        status: 'EmAndamento',
        data_fim: null,
      });
      expect(andamento.data_inicio).toBeInstanceOf(Date);
    });
  });

  describe('buscar_viagem_vinculavel', () => {
    function buscar(usuario: { id: string; perfil: PerfilNome; status?: StatusUsuario }, id: string) {
      return comoUsuario(db, usuario, (tx) =>
        tx.query<Record<string, unknown>>('select * from buscar_viagem_vinculavel($1)', [id]),
      );
    }

    // ACESSO-02: qualquer status ou data.
    it.each([
      ['antiga', 'Finalizada'],
      ['cancelada', 'Cancelada'],
    ] as const)('devolve a viagem %s, fora da janela da lista', async (nome, status) => {
      const resultado = await buscar(FINANCEIRO, viagem[nome]);

      expect(resultado.rows).toHaveLength(1);
      expect(Object.keys(resultado.rows[0]!).sort()).toEqual(COLUNAS_DA_RPC);
      expect(resultado.rows[0]).toMatchObject({ id: viagem[nome], status });
    });

    it('Admin também busca', async () => {
      const resultado = await buscar(ADMIN, viagem.recente);

      expect(resultado.rows.map((linha) => linha.id)).toEqual([viagem.recente]);
    });

    it('viagem inexistente devolve zero linhas', async () => {
      const resultado = await buscar(FINANCEIRO, '42199999-0000-0000-0000-000000000000');

      expect(resultado.rows).toEqual([]);
    });
  });

  // ACESSO-03
  describe.each([
    ['listar_viagens_vinculaveis()', 'select * from listar_viagens_vinculaveis()', [] as string[]],
    ['buscar_viagem_vinculavel(uuid)', 'select * from buscar_viagem_vinculavel($1)', ['VIAGEM']],
  ])('%s sem permissão', (_nome, sql, parametros) => {
    function params() {
      return parametros.map(() => viagem.andamento);
    }

    it.each([
      ['Gestor de Frota', '42100000-0000-0000-0000-000000000013', 'Ativo'],
      ['Motorista', '42100000-0000-0000-0000-000000000014', 'Ativo'],
      ['Financeiro', '42100000-0000-0000-0000-000000000022', 'Bloqueado'],
      ['Financeiro', '42100000-0000-0000-0000-000000000023', 'AguardandoAprovacao'],
    ] as [PerfilNome, string, StatusUsuario][])('%s (%s… status %s) recebe 42501', async (perfil, id, status) => {
      const codigo = await codigoDoErro(comoUsuario(db, { id, perfil, status }, (tx) => tx.query(sql, params())));

      expect(codigo).toBe('42501');
    });

    it('anon recebe 42501', async () => {
      const codigo = await codigoDoErro(comoAnonimo(db, (tx) => tx.query(sql, params())));

      expect(codigo).toBe('42501');
    });
  });

  // ACESSO-04, conferido no catálogo (lição L-006): a checagem de perfil sozinha faria o anon
  // receber 42501 mesmo sem o revoke.
  it.each(['listar_viagens_vinculaveis()', 'buscar_viagem_vinculavel(uuid)'])(
    'anon e public não executam %s; authenticated executa',
    async (assinatura) => {
      const privilegios = await db.query<{ anon: boolean; publico: boolean; authenticated: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                exists (
                  select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  where p.oid = $1::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
                ) as publico,
                has_function_privilege('authenticated', $1, 'execute') as authenticated`,
        [assinatura],
      );

      expect(privilegios.rows).toEqual([{ anon: false, publico: false, authenticated: true }]);
    },
  );

  // ACESSO-05: a RPC não abre a tabela.
  it('Financeiro continua lendo zero linhas de viagem direto na tabela', async () => {
    const direto = await comoUsuario(db, FINANCEIRO, (tx) => tx.query('select id from viagem'));

    expect(direto.rows).toEqual([]);
  });

  it('o índice de movimentacao.viagem_id existe', async () => {
    const indice = await comoSuperuser(db, (tx) =>
      tx.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'movimentacao_viagem_id_idx'`),
    );

    expect(indice.rows[0]?.indexdef).toContain('(viagem_id)');
  });
});
