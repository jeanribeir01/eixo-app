/** @jest-environment node */
// Testes da migration 20261109000100_kpis_dashboard.sql — EIX-44 (US11), cards da Home.
// Cada teste limpa as tabelas lidas e monta só os dados do cenário: as RPCs somam a tabela inteira.

import { criarBanco, comoAnonimo, comoSuperuser, comoUsuario, type Banco, type PerfilNome } from './helpers/db';

const FINANCEIRO = { id: '44000000-0000-0000-0000-000000000001', perfil: 'Financeiro' as const };
const ADMIN = { id: '44000000-0000-0000-0000-000000000002', perfil: 'Admin' as const };
const GESTOR = { id: '44000000-0000-0000-0000-000000000003', perfil: 'Gestor de Frota' as const };
const MOTORISTA = { id: '44000000-0000-0000-0000-000000000004', perfil: 'Motorista' as const };

type Usuario = { id: string; perfil: PerfilNome };

type KpisFinanceiros = {
  saldoAtualCentavos: number;
  totalReceberCentavos: number;
  totalPagarCentavos: number;
  quantidadeMovimentacoesPeriodo: number;
};

type KpisFrota = { veiculosEmViagem: number; dataReferencia: string };

type Lancamento = {
  tipo: 'Entrada' | 'Saida';
  // Em reais, como a coluna `numeric(12,2)` guarda.
  valor: string;
  status: 'Pago' | 'Pendente';
  vencimento?: string | null;
  pagamento?: string;
  // Instante ISO; sem ele, o banco usa now().
  inclusao?: string;
};

type Viagem = {
  status: 'EmAndamento' | 'Finalizada' | 'Cancelada';
  inicio?: string | null;
  fim?: string | null;
  inclusao: string;
  atualizacao?: string;
  // Mesmo veículo em duas viagens: o card conta veículos, não viagens.
  veiculoId?: string;
};

async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration kpis_dashboard', () => {
  let db: Banco;
  let categoriaEntrada: string;
  let categoriaSaida: string;
  let formaPagamento: string;
  let rotaId: string;
  let placas = 0;

  beforeAll(async () => {
    db = await criarBanco();

    const entrada = await db.query<{ id: string }>(`select id from categoria where titulo = 'Frete' and tipo = 'Entrada'`);
    categoriaEntrada = entrada.rows[0]!.id;
    const saida = await db.query<{ id: string }>(`select id from categoria where titulo = 'Combustível' and tipo = 'Saida'`);
    categoriaSaida = saida.rows[0]!.id;
    const forma = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix'`);
    formaPagamento = forma.rows[0]!.id;

    await comoUsuario(db, MOTORISTA, async () => {});
    const rota = await db.query<{ id: string }>(
      `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
       values ('São Paulo', 'SP', 'Curitiba', 'PR', 400) returning id`,
    );
    rotaId = rota.rows[0]!.id;
  });

  beforeEach(async () => {
    await db.query('delete from movimentacao');
    await db.query('delete from viagem');
  });

  afterAll(async () => {
    await db.close();
  });

  async function lancar(...lancamentos: Lancamento[]): Promise<void> {
    await comoSuperuser(db, async (tx) => {
      for (const l of lancamentos) {
        await tx.query(
          `insert into movimentacao
             (categoria_id, forma_pagamento_id, valor, descricao, status_pagamento, data_vencimento, data_pagamento,
              data_inclusao)
           values ($1, $2, $3::numeric, 'Teste', $4::status_pagamento, $5::date,
                   case when $4 = 'Pago' then coalesce($6::date, date '2026-10-01') end,
                   coalesce($7::timestamptz, now()))`,
          [
            l.tipo === 'Entrada' ? categoriaEntrada : categoriaSaida,
            formaPagamento,
            l.valor,
            l.status,
            l.vencimento ?? null,
            l.pagamento ?? null,
            l.inclusao ?? null,
          ],
        );
      }
    });
  }

  async function criarVeiculo(): Promise<string> {
    placas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga) values ($1, 'Volvo', 'FH', 10000) returning id`,
      [`KPI${String(placas).padStart(4, '0')}`],
    );
    return resultado.rows[0]!.id;
  }

  // Veículo próprio por viagem (salvo `veiculoId`): evita as regras de hodômetro entre viagens.
  async function registrarViagem(viagem: Viagem): Promise<string> {
    const veiculoId = viagem.veiculoId ?? (await criarVeiculo());
    await db.query(
      `insert into viagem
         (veiculo_id, rota_id, motorista_id, hodometro_inicial, hodometro_final, status,
          data_inicio, data_fim, data_inclusao, data_atualizacao)
       values ($1, $2, $3, 1000, case when $4 = 'EmAndamento' then null else 1500 end, $4::status_viagem,
               $5::timestamptz, $6::timestamptz, $7::timestamptz, coalesce($8::timestamptz, $7::timestamptz))`,
      [
        veiculoId,
        rotaId,
        MOTORISTA.id,
        viagem.status,
        viagem.inicio ?? null,
        viagem.fim ?? null,
        viagem.inclusao,
        viagem.atualizacao ?? null,
      ],
    );
    return veiculoId;
  }

  async function financeiros(
    dataInicial: string | null = '2026-10-01',
    dataFinal: string | null = '2026-10-31',
    usuario: Usuario = FINANCEIRO,
  ): Promise<KpisFinanceiros> {
    return comoUsuario(db, usuario, async (tx) => {
      const linha = await tx.query<{ r: KpisFinanceiros }>('select kpis_financeiros($1::date, $2::date) as r', [
        dataInicial,
        dataFinal,
      ]);
      return linha.rows[0]!.r;
    });
  }

  async function frota(
    dataInicial: string | null = '2026-10-01',
    dataFinal: string | null = '2026-10-31',
    usuario: Usuario = GESTOR,
  ): Promise<KpisFrota> {
    return comoUsuario(db, usuario, async (tx) => {
      const linha = await tx.query<{ r: KpisFrota }>('select kpis_frota($1::date, $2::date) as r', [
        dataInicial,
        dataFinal,
      ]);
      return linha.rows[0]!.r;
    });
  }

  // "Hoje" no fuso do Brasil, pelo relógio do próprio banco: o mesmo que as funções usam.
  async function hojeNoBanco(deslocamentoDias = 0): Promise<string> {
    const linha = await db.query<{ d: string }>(
      `select to_char((now() at time zone 'America/Sao_Paulo')::date + $1::int, 'YYYY-MM-DD') as d`,
      [deslocamentoDias],
    );
    return linha.rows[0]!.d;
  }

  describe('kpis_financeiros', () => {
    it('sem movimentações devolve tudo zerado', async () => {
      expect(await financeiros()).toEqual({
        saldoAtualCentavos: 0,
        totalReceberCentavos: 0,
        totalPagarCentavos: 0,
        quantidadeMovimentacoesPeriodo: 0,
      });
    });

    it('saldo atual soma o que foi pago até a data final, em centavos', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '1000.50', status: 'Pago', pagamento: '2026-09-15' },
        { tipo: 'Saida', valor: '200.25', status: 'Pago', pagamento: '2026-10-31' },
        // Pago depois da data final: ainda não fazia parte do saldo.
        { tipo: 'Entrada', valor: '999.00', status: 'Pago', pagamento: '2026-11-01' },
        // Pendente nunca entra no saldo.
        { tipo: 'Entrada', valor: '50.00', status: 'Pendente', vencimento: '2026-10-10' },
      );

      expect((await financeiros()).saldoAtualCentavos).toBe(80025);
    });

    it('saldo negativo sai negativo: a tela pinta de vermelho', async () => {
      await lancar({ tipo: 'Saida', valor: '10.00', status: 'Pago', pagamento: '2026-10-05' });

      expect((await financeiros()).saldoAtualCentavos).toBe(-1000);
    });

    it('a receber e a pagar somam só pendências com vencimento dentro do período', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '100.00', status: 'Pendente', vencimento: '2026-10-01' },
        { tipo: 'Entrada', valor: '50.00', status: 'Pendente', vencimento: '2026-10-31' },
        { tipo: 'Saida', valor: '30.00', status: 'Pendente', vencimento: '2026-10-15' },
        // Atrasada (venceu antes do início), depois do período e sem vencimento: ficam fora.
        { tipo: 'Entrada', valor: '7.00', status: 'Pendente', vencimento: '2026-09-30' },
        { tipo: 'Saida', valor: '8.00', status: 'Pendente', vencimento: '2026-11-01' },
        { tipo: 'Saida', valor: '9.00', status: 'Pendente' },
        // Já paga: não é mais "a pagar".
        { tipo: 'Saida', valor: '40.00', status: 'Pago', vencimento: '2026-10-20', pagamento: '2026-10-20' },
      );

      const kpis = await financeiros();

      expect(kpis.totalReceberCentavos).toBe(15000);
      expect(kpis.totalPagarCentavos).toBe(3000);
    });

    it('conta as movimentações do período pela regra da lista de Movimentações', async () => {
      await lancar(
        { tipo: 'Entrada', valor: '1.00', status: 'Pendente', vencimento: '2026-10-10' },
        { tipo: 'Saida', valor: '1.00', status: 'Pago', vencimento: '2026-10-20', pagamento: '2026-10-20' },
        // Sem vencimento: vale a data de inclusão no fuso do Brasil. 31/10 às 23h30 em Brasília
        // já é 01/11 em UTC e ainda conta em outubro.
        { tipo: 'Saida', valor: '1.00', status: 'Pendente', inclusao: '2026-11-01T02:30:00Z' },
        // Fora: vencimento em novembro e inclusão em 01/11 no horário de Brasília.
        { tipo: 'Entrada', valor: '1.00', status: 'Pendente', vencimento: '2026-11-05' },
        { tipo: 'Saida', valor: '1.00', status: 'Pendente', inclusao: '2026-11-01T03:30:00Z' },
      );

      expect((await financeiros()).quantidadeMovimentacoesPeriodo).toBe(3);
    });

    it('Admin também consulta', async () => {
      await lancar({ tipo: 'Entrada', valor: '10.00', status: 'Pago', pagamento: '2026-10-01' });

      expect((await financeiros('2026-10-01', '2026-10-31', ADMIN)).saldoAtualCentavos).toBe(1000);
    });

    it.each([GESTOR, MOTORISTA])('$perfil recebe 42501', async (usuario) => {
      expect(await codigoDoErro(financeiros('2026-10-01', '2026-10-31', usuario))).toBe('42501');
    });
  });

  describe('kpis_frota', () => {
    it('sem viagens devolve zero e a data final como referência', async () => {
      expect(await frota()).toEqual({ veiculosEmViagem: 0, dataReferencia: '2026-10-31' });
    });

    it('conta veículos com viagem aberta no fim do último dia do período', async () => {
      // Aberta durante o período e ainda em andamento.
      await registrarViagem({ status: 'EmAndamento', inicio: '2026-10-20T12:00:00Z', inclusao: '2026-10-20T12:00:00Z' });
      // Começou em outubro e terminou só em novembro.
      await registrarViagem({
        status: 'Finalizada',
        inicio: '2026-10-30T12:00:00Z',
        fim: '2026-11-02T12:00:00Z',
        inclusao: '2026-10-30T12:00:00Z',
      });
      // Terminou antes do fim de outubro.
      await registrarViagem({
        status: 'Finalizada',
        inicio: '2026-10-05T12:00:00Z',
        fim: '2026-10-08T12:00:00Z',
        inclusao: '2026-10-05T12:00:00Z',
      });
      // Começou depois do período: 01/11 às 00h30 em Brasília.
      await registrarViagem({ status: 'EmAndamento', inicio: '2026-11-01T03:30:00Z', inclusao: '2026-11-01T03:30:00Z' });
      // Cancelada nunca conta.
      await registrarViagem({ status: 'Cancelada', inicio: '2026-10-25T12:00:00Z', inclusao: '2026-10-25T12:00:00Z' });

      expect(await frota()).toEqual({ veiculosEmViagem: 2, dataReferencia: '2026-10-31' });
    });

    it('sem data_inicio usa a inclusão; sem data_fim usa a última atualização', async () => {
      await registrarViagem({ status: 'EmAndamento', inicio: null, inclusao: '2026-10-10T12:00:00Z' });
      // Fechada em 05/11 (pela atualização), então estava aberta em 31/10.
      await registrarViagem({
        status: 'Finalizada',
        inicio: null,
        fim: null,
        inclusao: '2026-10-10T12:00:00Z',
        atualizacao: '2026-11-05T12:00:00Z',
      });
      // Fechada em 15/10 (pela atualização).
      await registrarViagem({
        status: 'Finalizada',
        fim: null,
        inclusao: '2026-10-10T12:00:00Z',
        atualizacao: '2026-10-15T12:00:00Z',
      });

      expect((await frota()).veiculosEmViagem).toBe(2);
    });

    it('conta veículos, não viagens', async () => {
      const veiculoId = await registrarViagem({
        status: 'Finalizada',
        inicio: '2026-10-01T12:00:00Z',
        fim: '2026-11-03T12:00:00Z',
        inclusao: '2026-10-01T12:00:00Z',
      });
      // Relógio errado do celular: a segunda viagem do mesmo caminhão se sobrepõe à primeira.
      await db.query(
        `insert into viagem (veiculo_id, rota_id, motorista_id, hodometro_inicial, status, data_inicio, data_inclusao)
         values ($1, $2, $3, 1500, 'EmAndamento', '2026-10-30T12:00:00Z', '2026-10-30T12:00:00Z')`,
        [veiculoId, rotaId, MOTORISTA.id],
      );

      expect((await frota()).veiculosEmViagem).toBe(1);
    });

    it('período que ainda não terminou mostra quem está em viagem hoje', async () => {
      const inicio = await hojeNoBanco(-10);
      const fim = await hojeNoBanco(10);
      await registrarViagem({ status: 'EmAndamento', inclusao: new Date(Date.now() - 86_400_000).toISOString() });

      expect(await frota(inicio, fim)).toEqual({ veiculosEmViagem: 1, dataReferencia: await hojeNoBanco() });
    });

    it('Admin também consulta', async () => {
      await registrarViagem({ status: 'EmAndamento', inicio: '2026-10-20T12:00:00Z', inclusao: '2026-10-20T12:00:00Z' });

      expect((await frota('2026-10-01', '2026-10-31', ADMIN)).veiculosEmViagem).toBe(1);
    });

    it.each([FINANCEIRO, MOTORISTA])('$perfil recebe 42501', async (usuario) => {
      expect(await codigoDoErro(frota('2026-10-01', '2026-10-31', usuario))).toBe('42501');
    });
  });

  describe('período inválido, nas duas funções (mesmas regras do schema Zod)', () => {
    it.each([
      ['data vazia', null, '2026-10-31'],
      ['data final anterior à inicial', '2026-10-15', '2026-10-01'],
      ['mais de 366 dias', '2026-01-01', '2027-01-02'],
      ['o histórico inteiro', '1900-01-01', '9999-12-31'],
    ])('%s recebe 22023', async (_caso, dataInicial, dataFinal) => {
      expect(await codigoDoErro(financeiros(dataInicial, dataFinal, ADMIN))).toBe('22023');
      expect(await codigoDoErro(frota(dataInicial, dataFinal, ADMIN))).toBe('22023');
    });

    it('aceita um ano bissexto inteiro (366 dias) e um único dia', async () => {
      expect(await codigoDoErro(financeiros('2028-01-01', '2028-12-31', ADMIN))).toBeUndefined();
      expect(await codigoDoErro(frota('2026-10-05', '2026-10-05', ADMIN))).toBeUndefined();
    });
  });

  it('anônimo não executa nenhuma das duas', async () => {
    for (const funcao of ['kpis_financeiros', 'kpis_frota']) {
      const erro = await codigoDoErro(
        comoAnonimo(db, (tx) => tx.query(`select ${funcao}('2026-10-01'::date, '2026-10-31'::date)`)),
      );
      expect(erro).toBe('42501');
    }
  });
});
