/** @jest-environment node */
// Testes da migration 20261113000100_bi.sql — EIX-43 (US10), estatísticas de viagem, rota e veículo.
// Cada cenário usa um mês próprio de 2025 como período: as RPCs leem a tabela inteira, e o período
// isola um teste do outro sem precisar apagar dados.

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

const MIGRATION = '20261113000100_bi.sql';

const ADMIN = { id: '43000000-0000-0000-0000-000000000001', perfil: 'Admin' as const };
const FINANCEIRO = { id: '43000000-0000-0000-0000-000000000002', perfil: 'Financeiro' as const };
const GESTOR = { id: '43000000-0000-0000-0000-000000000003', perfil: 'Gestor de Frota' as const };
const MOTORISTA = { id: '43000000-0000-0000-0000-000000000004', perfil: 'Motorista' as const };
const PENDENTE = {
  id: '43000000-0000-0000-0000-000000000005',
  perfil: 'Financeiro' as const,
  status: 'AguardandoAprovacao' as StatusUsuario,
};

type Usuario = { id: string; perfil: PerfilNome; status?: StatusUsuario };

// Linha de `estatisticas_viagens` como o PostgREST entrega: JSON, então numeric e bigint viram number.
type EstatisticaViagem = {
  viagem_id: string;
  veiculo_id: string;
  placa: string;
  rota_id: string;
  cidade_origem: string;
  uf_origem: string;
  cidade_destino: string;
  uf_destino: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  km_rodado: number | null;
  receita_centavos: number;
  despesa_centavos: number;
  rentabilidade_centavos: number;
  litros: number | null;
  custo_por_km_centavos: number | null;
  consumo_km_por_litro: number | null;
};

const COLUNAS_VIAGEM = [
  'cidade_destino',
  'cidade_origem',
  'consumo_km_por_litro',
  'custo_por_km_centavos',
  'data_fim',
  'data_inicio',
  'despesa_centavos',
  'km_rodado',
  'litros',
  'placa',
  'receita_centavos',
  'rentabilidade_centavos',
  'rota_id',
  'status',
  'uf_destino',
  'uf_origem',
  'veiculo_id',
  'viagem_id',
];

type EstatisticaRota = {
  rota_id: string;
  cidade_origem: string;
  uf_origem: string;
  cidade_destino: string;
  uf_destino: string;
  quantidade_viagens: number;
  km_total: number;
  receita_centavos: number;
  despesa_centavos: number;
  lucro_centavos: number;
  custo_por_km_centavos: number | null;
  mais_lucrativa: boolean;
  maior_custo: boolean;
};

const COLUNAS_ROTA = [
  'cidade_destino',
  'cidade_origem',
  'custo_por_km_centavos',
  'despesa_centavos',
  'km_total',
  'lucro_centavos',
  'maior_custo',
  'mais_lucrativa',
  'quantidade_viagens',
  'receita_centavos',
  'rota_id',
  'uf_destino',
  'uf_origem',
];

type EstatisticaVeiculo = {
  veiculo_id: string;
  placa: string;
  marca: string;
  modelo: string;
  quantidade_viagens: number;
  km_total: number;
  despesa_centavos: number;
  custo_por_km_centavos: number | null;
};

const COLUNAS_VEICULO = [
  'custo_por_km_centavos',
  'despesa_centavos',
  'km_total',
  'marca',
  'modelo',
  'placa',
  'quantidade_viagens',
  'veiculo_id',
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

describe('migration bi', () => {
  let db: Banco;
  let formaId: string;
  let categoria: { frete: string; combustivel: string; pedagio: string };
  let placas = 0;
  let rotas = 0;

  async function criarVeiculo(placa?: string) {
    placas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga) values ($1, 'Volvo', 'FH', 10000) returning id`,
      [placa ?? `BIA${String(placas).padStart(4, '0')}`],
    );
    return resultado.rows[0]!.id;
  }

  // Cidades únicas por rota: o banco recusa dois trechos iguais ativos.
  async function criarRota(origem?: string, destino?: string) {
    rotas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
       values ($1, 'SP', $2, 'PR', 400) returning id`,
      [origem ?? `Origem ${rotas}`, destino ?? `Destino ${rotas}`],
    );
    return resultado.rows[0]!.id;
  }

  // Grava como superuser: o RLS fica fora. Sem `veiculoId`, cada viagem tem veículo próprio.
  async function criarViagem(dados: {
    rotaId: string;
    veiculoId?: string;
    status: 'EmAndamento' | 'Finalizada' | 'Cancelada';
    inicio: string | null;
    inclusao?: string;
    hodometroInicial?: number;
    hodometroFinal?: number | null;
  }) {
    const veiculoId = dados.veiculoId ?? (await criarVeiculo());
    const resultado = await db.query<{ id: string }>(
      `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, status,
                           data_inicio, data_fim, data_inclusao)
       values ($1, $2, $3, $4, $5, $6::status_viagem, $7::timestamptz,
               case when $6::status_viagem = 'Finalizada' then $7::timestamptz + interval '1 day' end,
               coalesce($8::timestamptz, now()))
       returning id`,
      [
        veiculoId,
        dados.rotaId,
        MOTORISTA.id,
        dados.hodometroInicial ?? 10000,
        dados.hodometroFinal === undefined ? (dados.status === 'EmAndamento' ? null : 11000) : dados.hodometroFinal,
        dados.status,
        dados.inicio,
        dados.inclusao ?? null,
      ],
    );
    return resultado.rows[0]!.id;
  }

  // `valor` em reais, como a coluna numeric(12,2) guarda.
  async function lancar(dados: {
    viagemId: string;
    categoriaId: string;
    valor: string;
    litros?: number;
    pago?: boolean;
  }) {
    await db.query(
      `insert into movimentacao (categoria_id, forma_pagamento_id, valor, descricao, viagem_id, litros,
                                 status_pagamento, data_pagamento)
       values ($1, $2, $3::numeric, 'Teste BI', $4, $5, $6, $7)`,
      [
        dados.categoriaId,
        formaId,
        dados.valor,
        dados.viagemId,
        dados.litros ?? null,
        dados.pago ? 'Pago' : 'Pendente',
        dados.pago ? '2025-01-10' : null,
      ],
    );
  }

  function estatisticasVeiculos(usuario: Usuario, inicial: string | null, final: string | null) {
    return comoUsuario(db, usuario, async (tx) => {
      const resultado = await tx.query<{ linha: EstatisticaVeiculo }>(
        `select to_jsonb(e) as linha from estatisticas_veiculos($1::date, $2::date) e`,
        [inicial, final],
      );
      return resultado.rows.map((r) => r.linha);
    });
  }

  function estatisticasRotas(usuario: Usuario, inicial: string | null, final: string | null) {
    return comoUsuario(db, usuario, async (tx) => {
      const resultado = await tx.query<{ linha: EstatisticaRota }>(
        `select to_jsonb(e) as linha from estatisticas_rotas($1::date, $2::date) e`,
        [inicial, final],
      );
      return resultado.rows.map((r) => r.linha);
    });
  }

  function estatisticasViagens(usuario: Usuario, inicial: string | null, final: string | null) {
    return comoUsuario(db, usuario, async (tx) => {
      const resultado = await tx.query<{ linha: EstatisticaViagem }>(
        `select to_jsonb(e) as linha from estatisticas_viagens($1::date, $2::date) e`,
        [inicial, final],
      );
      return resultado.rows.map((r) => r.linha);
    });
  }

  beforeAll(async () => {
    // O Supabase concede `execute` em toda função nova e `select` em toda tabela/view nova a anon e
    // authenticated (privilégio padrão do schema public); o stub do PGlite não. Sem imitar isso, o
    // teste dos grants passaria mesmo sem os `revoke` da migration (lição L-006).
    db = await criarBanco({ antesDe: MIGRATION });
    await db.exec(`
      alter default privileges in schema public grant execute on functions to anon, authenticated;
      alter default privileges in schema public grant select on tables to anon, authenticated;
    `);
    await aplicarMigration(db, MIGRATION);
    for (const usuario of [ADMIN, FINANCEIRO, GESTOR, MOTORISTA, PENDENTE]) {
      await comoUsuario(db, usuario, async () => {});
    }

    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix'`);
    formaId = forma.rows[0]!.id;

    const categorias = await db.query<{ id: string; titulo: string }>(
      `select id, titulo from categoria where titulo in ('Combustível', 'Frete', 'Pedágio')`,
    );
    const porTitulo = Object.fromEntries(categorias.rows.map((linha) => [linha.titulo, linha.id]));
    categoria = { combustivel: porTitulo['Combustível']!, frete: porTitulo['Frete']!, pedagio: porTitulo['Pedágio']! };
  });

  afterAll(async () => {
    await db.close();
  });

  describe('estatisticas_viagens', () => {
    it('BI-01..04: calcula rentabilidade, R$/KM e KM/L com centavos exatos, pagas e pendentes', async () => {
      const rotaId = await criarRota('Sao Paulo', 'Curitiba');
      const viagemId = await criarViagem({
        rotaId,
        status: 'Finalizada',
        inicio: '2025-01-15T12:00:00Z',
        hodometroInicial: 10000,
        hodometroFinal: 11000,
      });
      // Frete pendente e pedágio pendente entram (regime de competência); o combustível está pago.
      await lancar({ viagemId, categoriaId: categoria.frete, valor: '5000.00' });
      await lancar({ viagemId, categoriaId: categoria.combustivel, valor: '1234.57', litros: 300, pago: true });
      await lancar({ viagemId, categoriaId: categoria.pedagio, valor: '100.00' });

      const linhas = await estatisticasViagens(FINANCEIRO, '2025-01-01', '2025-01-31');

      expect(linhas).toHaveLength(1);
      const linha = linhas[0]!;
      expect(linha.viagem_id).toBe(viagemId);
      expect(linha.rota_id).toBe(rotaId);
      expect(linha.cidade_origem).toBe('Sao Paulo');
      expect(linha.cidade_destino).toBe('Curitiba');
      expect(linha.status).toBe('Finalizada');
      expect(linha.km_rodado).toBe(1000);
      expect(linha.receita_centavos).toBe(500000);
      expect(linha.despesa_centavos).toBe(133457);
      expect(linha.rentabilidade_centavos).toBe(366543);
      expect(linha.litros).toBe(300);
      // 133457 / 1000 = 133,457 → 133 centavos por KM.
      expect(linha.custo_por_km_centavos).toBe(133);
      // 1000 / 300 = 3,333… → 3,33.
      expect(linha.consumo_km_por_litro).toBe(3.33);
    });

    it('BI-01: devolve exatamente as colunas da spec, com a placa do veículo', async () => {
      const rotaId = await criarRota();
      const veiculoId = await criarVeiculo('BIC0001');
      await criarViagem({ rotaId, veiculoId, status: 'Finalizada', inicio: '2025-02-10T12:00:00Z' });

      const [linha] = await estatisticasViagens(GESTOR, '2025-02-01', '2025-02-28');

      expect(Object.keys(linha!).sort()).toEqual(COLUNAS_VIAGEM);
      expect(linha!.placa).toBe('BIC0001');
      expect(linha!.veiculo_id).toBe(veiculoId);
    });

    it('BI-01: ordena da viagem mais recente para a mais antiga', async () => {
      const rotaId = await criarRota();
      const antiga = await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-03-02T12:00:00Z' });
      const recente = await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-03-20T12:00:00Z' });
      const meio = await criarViagem({ rotaId, status: 'EmAndamento', inicio: '2025-03-10T12:00:00Z' });

      const linhas = await estatisticasViagens(ADMIN, '2025-03-01', '2025-03-31');

      expect(linhas.map((l) => l.viagem_id)).toEqual([recente, meio, antiga]);
    });

    it('BI-05: viagem sem hodômetro final tem KM, R$/KM e KM/L nulos, mas soma os lançamentos', async () => {
      const rotaId = await criarRota();
      const viagemId = await criarViagem({ rotaId, status: 'EmAndamento', inicio: '2025-04-10T12:00:00Z' });
      await lancar({ viagemId, categoriaId: categoria.frete, valor: '800.00' });
      await lancar({ viagemId, categoriaId: categoria.combustivel, valor: '300.00', litros: 100 });

      const [linha] = await estatisticasViagens(FINANCEIRO, '2025-04-01', '2025-04-30');

      expect(linha!.km_rodado).toBeNull();
      expect(linha!.custo_por_km_centavos).toBeNull();
      expect(linha!.consumo_km_por_litro).toBeNull();
      expect(linha!.litros).toBe(100);
      expect(linha!.rentabilidade_centavos).toBe(50000);
    });

    it('BI-06: viagem sem litros tem litros e KM/L nulos, e o R$/KM continua calculado', async () => {
      const rotaId = await criarRota();
      const viagemId = await criarViagem({
        rotaId,
        status: 'Finalizada',
        inicio: '2025-05-10T12:00:00Z',
        hodometroInicial: 0,
        hodometroFinal: 400,
      });
      await lancar({ viagemId, categoriaId: categoria.pedagio, valor: '200.00' });

      const [linha] = await estatisticasViagens(FINANCEIRO, '2025-05-01', '2025-05-31');

      expect(linha!.litros).toBeNull();
      expect(linha!.consumo_km_por_litro).toBeNull();
      expect(linha!.custo_por_km_centavos).toBe(50);
    });

    it('BI-07: viagem sem lançamento vinculado tem receita, despesa e rentabilidade 0', async () => {
      const rotaId = await criarRota();
      await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-06-10T12:00:00Z' });

      const [linha] = await estatisticasViagens(FINANCEIRO, '2025-06-01', '2025-06-30');

      expect(linha!.receita_centavos).toBe(0);
      expect(linha!.despesa_centavos).toBe(0);
      expect(linha!.rentabilidade_centavos).toBe(0);
      expect(linha!.custo_por_km_centavos).toBe(0);
      expect(linha!.litros).toBeNull();
      expect(linha!.consumo_km_por_litro).toBeNull();
    });

    it('BI-08: deixa de fora a viagem cancelada e a iniciada fora do período, no fuso do Brasil', async () => {
      const rotaId = await criarRota();
      // 23h30 de 30/07 em São Paulo (02h30 de 31/07 em UTC): entra no período que termina em 30/07.
      const ultimaNoite = await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-07-31T02:30:00Z' });
      // 00h30 de 31/07 em São Paulo: fica fora.
      await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-07-31T03:30:00Z' });
      // 23h00 de 30/06 em São Paulo (02h00 de 01/07 em UTC): fica fora do período que começa em 01/07.
      await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-07-01T02:00:00Z' });
      await criarViagem({ rotaId, status: 'Cancelada', inicio: '2025-07-15T12:00:00Z', hodometroFinal: null });
      // Sem data_inicio (o celular não mandou), vale a data de inclusão.
      const semInicio = await criarViagem({
        rotaId,
        status: 'EmAndamento',
        inicio: null,
        inclusao: '2025-07-20T12:00:00Z',
      });

      const linhas = await estatisticasViagens(FINANCEIRO, '2025-07-01', '2025-07-30');

      expect(linhas.map((l) => l.viagem_id).sort()).toEqual([ultimaNoite, semInicio].sort());
    });

    it('BI-15: Admin, Gestor de Frota e Financeiro chamam; Motorista e conta não aprovada recebem 42501', async () => {
      const rotaId = await criarRota();
      await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-08-10T12:00:00Z' });

      await expect(estatisticasViagens(ADMIN, '2025-08-01', '2025-08-31')).resolves.toHaveLength(1);
      await expect(estatisticasViagens(GESTOR, '2025-08-01', '2025-08-31')).resolves.toHaveLength(1);
      await expect(estatisticasViagens(FINANCEIRO, '2025-08-01', '2025-08-31')).resolves.toHaveLength(1);
      expect(await codigoDoErro(estatisticasViagens(MOTORISTA, '2025-08-01', '2025-08-31'))).toBe('42501');
      expect(await codigoDoErro(estatisticasViagens(PENDENTE, '2025-08-01', '2025-08-31'))).toBe('42501');
    });

    it('BI-16: recusa com 22023 data nula, intervalo invertido e período acima de 366 dias', async () => {
      expect(await codigoDoErro(estatisticasViagens(ADMIN, null, '2025-01-31'))).toBe('22023');
      expect(await codigoDoErro(estatisticasViagens(ADMIN, '2025-01-01', null))).toBe('22023');
      expect(await codigoDoErro(estatisticasViagens(ADMIN, '2025-01-31', '2025-01-01'))).toBe('22023');
      // 01/01/2024 a 01/01/2025 são 367 dias (2024 é bissexto); até 31/12/2024 são 366.
      expect(await codigoDoErro(estatisticasViagens(ADMIN, '2024-01-01', '2025-01-01'))).toBe('22023');
      await expect(estatisticasViagens(ADMIN, '2024-01-01', '2024-12-31')).resolves.toEqual([]);
    });
  });

  describe('estatisticas_rotas', () => {
    it('BI-09: soma só as viagens finalizadas da rota e deixa de fora a rota sem viagem finalizada', async () => {
      const rotaId = await criarRota('Rota Soma', 'Destino Soma');
      const primeira = await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-09-05T12:00:00Z' });
      await lancar({ viagemId: primeira, categoriaId: categoria.frete, valor: '3000.00' });
      await lancar({ viagemId: primeira, categoriaId: categoria.combustivel, valor: '1000.00', litros: 300 });
      const segunda = await criarViagem({ rotaId, status: 'Finalizada', inicio: '2025-09-15T12:00:00Z' });
      await lancar({ viagemId: segunda, categoriaId: categoria.frete, valor: '2000.00' });
      await lancar({ viagemId: segunda, categoriaId: categoria.pedagio, valor: '500.00' });
      // Em andamento na mesma rota: tem lançamento, mas não tem KM, e não entra na soma.
      const andamento = await criarViagem({ rotaId, status: 'EmAndamento', inicio: '2025-09-20T12:00:00Z' });
      await lancar({ viagemId: andamento, categoriaId: categoria.frete, valor: '9999.00' });
      // Rota com só uma viagem em andamento: fica fora da lista.
      const rotaSemFinalizada = await criarRota('Rota Aberta', 'Destino Aberta');
      await criarViagem({ rotaId: rotaSemFinalizada, status: 'EmAndamento', inicio: '2025-09-10T12:00:00Z' });

      const linhas = await estatisticasRotas(GESTOR, '2025-09-01', '2025-09-30');

      expect(linhas).toHaveLength(1);
      expect(Object.keys(linhas[0]!).sort()).toEqual(COLUNAS_ROTA);
      expect(linhas[0]).toMatchObject({
        rota_id: rotaId,
        cidade_origem: 'Rota Soma',
        cidade_destino: 'Destino Soma',
        quantidade_viagens: 2,
        km_total: 2000,
        receita_centavos: 500000,
        despesa_centavos: 150000,
        lucro_centavos: 350000,
        // 150000 / 2000 = 75 centavos por KM.
        custo_por_km_centavos: 75,
      });
    });

    it('BI-10..12: ordena por lucro e marca a mais lucrativa e a de maior R$/KM', async () => {
      // A: lucro R$ 900, 1000 KM, R$/KM 10. B: lucro R$ 200, 100 KM, R$/KM 300.
      // C: lucro R$ 900 (empata com A), 500 KM, R$/KM 20: perde para A no KM.
      const rotaA = await criarRota('Rota A', 'Destino A');
      const viagemA = await criarViagem({ rotaId: rotaA, status: 'Finalizada', inicio: '2025-10-05T12:00:00Z' });
      await lancar({ viagemId: viagemA, categoriaId: categoria.frete, valor: '1000.00' });
      await lancar({ viagemId: viagemA, categoriaId: categoria.pedagio, valor: '100.00' });

      const rotaB = await criarRota('Rota B', 'Destino B');
      const viagemB = await criarViagem({
        rotaId: rotaB,
        status: 'Finalizada',
        inicio: '2025-10-06T12:00:00Z',
        hodometroInicial: 0,
        hodometroFinal: 100,
      });
      await lancar({ viagemId: viagemB, categoriaId: categoria.frete, valor: '500.00' });
      await lancar({ viagemId: viagemB, categoriaId: categoria.pedagio, valor: '300.00' });

      const rotaC = await criarRota('Rota C', 'Destino C');
      const viagemC = await criarViagem({
        rotaId: rotaC,
        status: 'Finalizada',
        inicio: '2025-10-07T12:00:00Z',
        hodometroInicial: 0,
        hodometroFinal: 500,
      });
      await lancar({ viagemId: viagemC, categoriaId: categoria.frete, valor: '1000.00' });
      await lancar({ viagemId: viagemC, categoriaId: categoria.pedagio, valor: '100.00' });

      const linhas = await estatisticasRotas(FINANCEIRO, '2025-10-01', '2025-10-31');

      expect(linhas.map((l) => l.rota_id)).toEqual([rotaA, rotaC, rotaB]);
      expect(linhas.map((l) => l.lucro_centavos)).toEqual([90000, 90000, 20000]);
      expect(linhas.map((l) => l.custo_por_km_centavos)).toEqual([10, 20, 300]);
      expect(linhas.map((l) => l.mais_lucrativa)).toEqual([true, false, false]);
      expect(linhas.map((l) => l.maior_custo)).toEqual([false, false, true]);
    });

    it('BI-10..12: empate em lucro, KM e R$/KM desempata pela origem em ordem alfabética', async () => {
      const beta = await criarRota('Beta', 'Destino Empate');
      const alfa = await criarRota('Alfa', 'Destino Empate');
      for (const [rotaId, dia] of [
        [beta, '2025-11-05'],
        [alfa, '2025-11-06'],
      ] as const) {
        const viagemId = await criarViagem({ rotaId, status: 'Finalizada', inicio: `${dia}T12:00:00Z` });
        await lancar({ viagemId, categoriaId: categoria.frete, valor: '100.00' });
        await lancar({ viagemId, categoriaId: categoria.pedagio, valor: '50.00' });
      }

      const linhas = await estatisticasRotas(ADMIN, '2025-11-01', '2025-11-30');

      expect(linhas.map((l) => l.rota_id)).toEqual([alfa, beta]);
      expect(linhas.map((l) => l.mais_lucrativa)).toEqual([true, false]);
      expect(linhas.map((l) => l.maior_custo)).toEqual([true, false]);
    });

    it('BI-11, BI-12: lucro negativo ainda marca a rota que perde menos', async () => {
      const rotaId = await criarRota('Rota Prejuizo', 'Destino Prejuizo');
      const viagemId = await criarViagem({ rotaId, status: 'Finalizada', inicio: '2026-01-05T12:00:00Z' });
      await lancar({ viagemId, categoriaId: categoria.pedagio, valor: '100.00' });

      const [linha] = await estatisticasRotas(ADMIN, '2026-01-01', '2026-01-31');

      expect(linha).toMatchObject({ lucro_centavos: -10000, mais_lucrativa: true, maior_custo: true });
    });

    it('BI-11, BI-12: período sem viagem finalizada devolve lista vazia, sem destaque', async () => {
      const rotaId = await criarRota();
      await criarViagem({ rotaId, status: 'EmAndamento', inicio: '2025-12-10T12:00:00Z' });

      await expect(estatisticasRotas(ADMIN, '2025-12-01', '2025-12-31')).resolves.toEqual([]);
    });

    it('BI-15, BI-16: Motorista recebe 42501 e período invertido recebe 22023', async () => {
      const rotaId = await criarRota();
      await criarViagem({ rotaId, status: 'Finalizada', inicio: '2026-02-10T12:00:00Z' });

      await expect(estatisticasRotas(GESTOR, '2026-02-01', '2026-02-28')).resolves.toHaveLength(1);
      await expect(estatisticasRotas(FINANCEIRO, '2026-02-01', '2026-02-28')).resolves.toHaveLength(1);
      expect(await codigoDoErro(estatisticasRotas(MOTORISTA, '2026-02-01', '2026-02-28'))).toBe('42501');
      expect(await codigoDoErro(estatisticasRotas(PENDENTE, '2026-02-01', '2026-02-28'))).toBe('42501');
      expect(await codigoDoErro(estatisticasRotas(ADMIN, '2025-09-30', '2025-09-01'))).toBe('22023');
      expect(await codigoDoErro(estatisticasRotas(ADMIN, null, '2025-09-01'))).toBe('22023');
      expect(await codigoDoErro(estatisticasRotas(ADMIN, '2024-01-01', '2025-01-01'))).toBe('22023');
    });
  });

  describe('estatisticas_veiculos', () => {
    it('BI-13: R$/KM do veículo é a razão das somas das viagens finalizadas, não a média das razões', async () => {
      const rotaId = await criarRota();
      const veiculoId = await criarVeiculo('VEI0001');
      // 100 KM com R$ 300 (R$/KM 300) e 300 KM com R$ 500 (R$/KM 166,67). Média das razões: 233.
      const primeira = await criarViagem({
        rotaId,
        veiculoId,
        status: 'Finalizada',
        inicio: '2026-03-05T12:00:00Z',
        hodometroInicial: 0,
        hodometroFinal: 100,
      });
      await lancar({ viagemId: primeira, categoriaId: categoria.pedagio, valor: '300.00' });
      const segunda = await criarViagem({
        rotaId,
        veiculoId,
        status: 'Finalizada',
        inicio: '2026-03-10T12:00:00Z',
        hodometroInicial: 100,
        hodometroFinal: 400,
      });
      await lancar({ viagemId: segunda, categoriaId: categoria.pedagio, valor: '500.00' });
      // Em andamento no mesmo veículo: não entra na soma.
      const andamento = await criarViagem({
        rotaId,
        veiculoId,
        status: 'EmAndamento',
        inicio: '2026-03-20T12:00:00Z',
        hodometroInicial: 400,
      });
      await lancar({ viagemId: andamento, categoriaId: categoria.pedagio, valor: '999.00' });
      // Veículo com só uma viagem em andamento: fica fora da lista.
      await criarViagem({ rotaId, status: 'EmAndamento', inicio: '2026-03-15T12:00:00Z' });

      const linhas = await estatisticasVeiculos(GESTOR, '2026-03-01', '2026-03-31');

      expect(linhas).toHaveLength(1);
      expect(Object.keys(linhas[0]!).sort()).toEqual(COLUNAS_VEICULO);
      expect(linhas[0]).toEqual({
        veiculo_id: veiculoId,
        placa: 'VEI0001',
        marca: 'Volvo',
        modelo: 'FH',
        quantidade_viagens: 2,
        km_total: 400,
        despesa_centavos: 80000,
        // 80000 / 400 = 200.
        custo_por_km_centavos: 200,
      });
    });

    it('BI-14: ordena por maior R$/KM, depois maior KM, depois placa', async () => {
      const rotaId = await criarRota();
      const cenarios = [
        // [placa, KM, Saída em reais] → R$/KM
        ['ZZZ0001', 500, '500.00'], // 100, 500 KM
        ['VEI0100', 100, '300.00'], // 300
        ['AAA0001', 500, '500.00'], // 100, 500 KM: empata com ZZZ0001 e vence pela placa
        ['VEI0200', 1000, '1000.00'], // 100, 1000 KM
      ] as const;
      const ids: Record<string, string> = {};
      for (const [placa, km, valor] of cenarios) {
        const veiculoId = await criarVeiculo(placa);
        ids[placa] = veiculoId;
        const viagemId = await criarViagem({
          rotaId,
          veiculoId,
          status: 'Finalizada',
          inicio: '2026-04-10T12:00:00Z',
          hodometroInicial: 0,
          hodometroFinal: km,
        });
        await lancar({ viagemId, categoriaId: categoria.pedagio, valor });
      }

      const linhas = await estatisticasVeiculos(FINANCEIRO, '2026-04-01', '2026-04-30');

      expect(linhas.map((l) => l.placa)).toEqual(['VEI0100', 'VEI0200', 'AAA0001', 'ZZZ0001']);
      expect(linhas.map((l) => l.custo_por_km_centavos)).toEqual([300, 100, 100, 100]);
    });

    it('BI-15, BI-16: Motorista recebe 42501 e período inválido recebe 22023', async () => {
      const rotaId = await criarRota();
      await criarViagem({ rotaId, status: 'Finalizada', inicio: '2026-05-10T12:00:00Z' });

      await expect(estatisticasVeiculos(ADMIN, '2026-05-01', '2026-05-31')).resolves.toHaveLength(1);
      await expect(estatisticasVeiculos(GESTOR, '2026-05-01', '2026-05-31')).resolves.toHaveLength(1);
      await expect(estatisticasVeiculos(FINANCEIRO, '2026-05-01', '2026-05-31')).resolves.toHaveLength(1);
      expect(await codigoDoErro(estatisticasVeiculos(MOTORISTA, '2026-05-01', '2026-05-31'))).toBe('42501');
      expect(await codigoDoErro(estatisticasVeiculos(PENDENTE, '2026-05-01', '2026-05-31'))).toBe('42501');
      expect(await codigoDoErro(estatisticasVeiculos(ADMIN, '2026-05-31', '2026-05-01'))).toBe('22023');
      expect(await codigoDoErro(estatisticasVeiculos(ADMIN, '2026-05-01', null))).toBe('22023');
      expect(await codigoDoErro(estatisticasVeiculos(ADMIN, '2024-01-01', '2025-01-01'))).toBe('22023');
    });
  });

  describe('acesso e índices', () => {
    it('BI-17: só authenticated executa estatisticas_veiculos', async () => {
      const resultado = await db.query<{ anon: boolean; publico: boolean; autenticado: boolean }>(
        `select has_function_privilege('anon', 'estatisticas_veiculos(date, date)', 'execute') as anon,
                has_function_privilege('public', 'estatisticas_veiculos(date, date)', 'execute') as publico,
                has_function_privilege('authenticated', 'estatisticas_veiculos(date, date)', 'execute') as autenticado`,
      );
      expect(resultado.rows[0]).toEqual({ anon: false, publico: false, autenticado: true });
    });

    it('BI-17: só authenticated executa estatisticas_rotas', async () => {
      const resultado = await db.query<{ anon: boolean; publico: boolean; autenticado: boolean }>(
        `select has_function_privilege('anon', 'estatisticas_rotas(date, date)', 'execute') as anon,
                has_function_privilege('public', 'estatisticas_rotas(date, date)', 'execute') as publico,
                has_function_privilege('authenticated', 'estatisticas_rotas(date, date)', 'execute') as autenticado`,
      );
      expect(resultado.rows[0]).toEqual({ anon: false, publico: false, autenticado: true });
    });

    it('BI-17: só authenticated executa estatisticas_viagens', async () => {
      const resultado = await db.query<{ anon: boolean; publico: boolean; autenticado: boolean }>(
        `select has_function_privilege('anon', 'estatisticas_viagens(date, date)', 'execute') as anon,
                has_function_privilege('public', 'estatisticas_viagens(date, date)', 'execute') as publico,
                has_function_privilege('authenticated', 'estatisticas_viagens(date, date)', 'execute') as autenticado`,
      );
      expect(resultado.rows[0]).toEqual({ anon: false, publico: false, autenticado: true });
    });

    it('BI-17: ninguém da API lê a view estatistica_viagem direto', async () => {
      const resultado = await db.query<{ anon: boolean; autenticado: boolean }>(
        `select has_table_privilege('anon', 'estatistica_viagem', 'select') as anon,
                has_table_privilege('authenticated', 'estatistica_viagem', 'select') as autenticado`,
      );
      expect(resultado.rows[0]).toEqual({ anon: false, autenticado: false });

      const leitura = comoUsuario(db, ADMIN, (tx) => tx.query('select * from estatistica_viagem'));
      expect(await codigoDoErro(leitura)).toBe('42501');
      expect(await codigoDoErro(comoAnonimo(db, (tx) => tx.query('select * from estatistica_viagem')))).toBe('42501');
    });

    it('BI-18: viagem tem índice completo (não parcial) em rota_id e em veiculo_id', async () => {
      const resultado = await comoSuperuser(db, (tx) =>
        tx.query<{ coluna: string }>(
          `select a.attname as coluna
             from pg_index i
             join pg_class t on t.oid = i.indrelid
             join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
            where t.relname = 'viagem' and i.indnatts = 1 and i.indpred is null
              and a.attname in ('rota_id', 'veiculo_id')`,
        ),
      );
      expect(resultado.rows.map((r) => r.coluna).sort()).toEqual(['rota_id', 'veiculo_id']);
    });
  });
});
