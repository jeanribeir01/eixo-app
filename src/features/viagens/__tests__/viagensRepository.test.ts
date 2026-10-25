import { eq } from 'drizzle-orm';

import * as local from '@/db/schema';
import { criarBancoDeTeste, type BancoDeTeste } from '@/db/testing';

import {
  abrirViagemComUltimoHodometroSchema,
  abrirViagemSchema,
  fecharViagemFormSchema,
  fecharViagemSchema,
} from '../schema';
import {
  abrirViagem,
  buscarUltimoHodometro,
  buscarVeiculo,
  buscarViagemPorId,
  fecharViagem,
  listarMotoristasAtivos,
  listarRotasAtivas,
  listarVeiculosDisponiveis,
  listarViagens,
  MENSAGEM_ROTA_FORA_DO_APARELHO,
  MENSAGEM_VEICULO_FORA_DO_APARELHO,
  MENSAGEM_VIAGEM_NAO_ABERTA,
  MENSAGENS_ERRO_CONSTRAINT_VIAGEM,
  MENSAGENS_ERRO_VIAGEM,
  setDb,
  traduzirErroBanco,
  viagensRepository,
  type ViagensDb,
} from '../viagensRepository';
import type { NovaViagemInput, ViagensRepository } from '../types';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = [
  'select',
  'insert',
  'update',
  'delete',
  'eq',
  'not',
  'order',
  'limit',
  'single',
  'maybeSingle',
] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function criarBuilder(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
    then: <R1, R2>(
      onFulfilled?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ) => Promise.resolve(resposta).then(onFulfilled, onRejected),
  });

  for (const metodo of METODOS) {
    metodos[metodo] =
      metodo === 'single' || metodo === 'maybeSingle'
        ? jest.fn(() => Promise.resolve(resposta))
        : jest.fn(() => builder);
  }

  return builder;
}

function responder(...respostas: Resposta[]): Builder[] {
  const builders = respostas.map(criarBuilder);
  const fila = [...builders];
  mockFrom.mockImplementation(() => {
    const proximo = fila.shift();
    if (!proximo) throw new Error('from() chamado mais vezes que o esperado');
    return proximo;
  });
  return builders;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string, message = `detalhe ${code}`): Resposta => ({
  data: null,
  error: { code, message },
});

function erroDeConstraint(code: '23505' | '23514', constraint: string): Resposta {
  return erro(
    code,
    code === '23505'
      ? `duplicate key value violates unique constraint "${constraint}"`
      : `new row for relation "viagem" violates check constraint "${constraint}"`,
  );
}

describe('viagensRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mapeamento de erros do banco (VG001 a VG007)', () => {
    it.each([
      ['VG001', MENSAGENS_ERRO_VIAGEM.VG001, 'veiculo_id'],
      ['VG002', MENSAGENS_ERRO_VIAGEM.VG002, 'veiculo_id'],
      ['VG003', MENSAGENS_ERRO_VIAGEM.VG003, 'veiculo_id'],
      ['VG004', MENSAGENS_ERRO_VIAGEM.VG004, 'hodometro_inicial'],
      ['VG005', MENSAGENS_ERRO_VIAGEM.VG005, 'status'],
      ['VG006', MENSAGENS_ERRO_VIAGEM.VG006, 'veiculo_id'],
      ['VG007', MENSAGENS_ERRO_VIAGEM.VG007, 'hodometro_final'],
      ['428C9', MENSAGENS_ERRO_VIAGEM['428C9'], undefined],
    ])('mapeia código %s para mensagem amigável e campo correspondente', (code, mensagemEsperada, campoEsperado) => {
      const resultado = traduzirErroBanco({ code }, 'Erro padrão');
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.mensagem).toBe(mensagemEsperada);
        expect(resultado.campo).toBe(campoEsperado);
        expect(resultado.codigo).toBe(code);
      }
    });

    it('mapeia 42501 para acesso negado', () => {
      const resultado = traduzirErroBanco({ code: '42501' }, 'Erro padrão');
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.mensagem).toContain('Acesso negado');
      }
    });

    it('usa a mensagem padrão para códigos desconhecidos', () => {
      const resultado = traduzirErroBanco({ code: '99999' }, 'Ocorreu uma falha inesperada.');
      expect(resultado).toEqual({
        ok: false,
        mensagem: 'Ocorreu uma falha inesperada.',
        codigo: '99999',
      });
    });
  });

  describe('Diferenciação de 23505 e 23514 pela constraint', () => {
    it('23505 do índice de viagem em andamento vira "veículo em andamento"', () => {
      const resposta = erroDeConstraint('23505', 'viagem_um_andamento_por_veiculo');
      const resultado = traduzirErroBanco(resposta.error!, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_um_andamento_por_veiculo,
        campo: 'veiculo_id',
        codigo: '23505',
      });
    });

    it('23505 da chave primária não vira "veículo em andamento"', () => {
      const resposta = erroDeConstraint('23505', 'viagem_pkey');
      const resultado = traduzirErroBanco(resposta.error!, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_pkey,
        codigo: '23505',
      });
    });

    it('23505 sem constraint identificada usa o fallback de registro duplicado', () => {
      const resultado = traduzirErroBanco({ code: '23505', message: 'detalhe técnico' }, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM['23505'],
        codigo: '23505',
      });
    });

    it.each([
      [
        'viagem_hodometro_inicial_nao_negativo',
        MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_hodometro_inicial_nao_negativo,
        'hodometro_inicial',
      ],
      [
        'viagem_hodometro_final_maior',
        MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_hodometro_final_maior,
        'hodometro_final',
      ],
      [
        'viagem_finalizada_tem_hodometro_final',
        MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_finalizada_tem_hodometro_final,
        'hodometro_final',
      ],
    ] as const)('23514 da constraint %s tem mensagem e campo próprios', (constraint, mensagemEsperada, campoEsperado) => {
      const resposta = erroDeConstraint('23514', constraint);
      const resultado = traduzirErroBanco(resposta.error!, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: mensagemEsperada,
        campo: campoEsperado,
        codigo: '23514',
      });
    });

    it('23514 sem constraint identificada usa o fallback de hodômetro inválido', () => {
      const resultado = traduzirErroBanco({ code: '23514', message: 'detalhe técnico' }, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
        codigo: '23514',
      });
    });
  });

  describe('Validação de Schemas Zod', () => {
    it('valida payload correto de abertura de viagem', () => {
      const input: NovaViagemInput = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 15000,
      };

      const resultado = abrirViagemSchema.safeParse(input);
      expect(resultado.success).toBe(true);
    });

    it('rejeita hodômetro inicial negativo', () => {
      const input = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: -1,
      };

      const resultado = abrirViagemSchema.safeParse(input);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]?.message).toBe('O hodômetro inicial não pode ser negativo.');
      }
    });

    it('rejeita abertura sem veículo selecionado', () => {
      const input = {
        veiculo_id: '',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 1000,
      };

      const resultado = abrirViagemSchema.safeParse(input);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]?.message).toBe('Selecione um veículo.');
      }
    });

    it('rejeita fechamento com hodômetro final zero ou negativo', () => {
      const resultadoZero = fecharViagemSchema.safeParse({ hodometro_final: 0 });
      expect(resultadoZero.success).toBe(false);

      const resultadoNegativo = fecharViagemSchema.safeParse({ hodometro_final: -50 });
      expect(resultadoNegativo.success).toBe(false);
    });

    it.each([9999, 10000])(
      'rejeita no formulário o final menor ou igual ao inicial (%s) usando a mensagem do schema',
      (hodometroFinal) => {
        const resultado = fecharViagemFormSchema.safeParse({
          hodometro_inicial: 10000,
          hodometro_final: hodometroFinal,
        });

        expect(resultado.success).toBe(false);
        if (!resultado.success) {
          expect(resultado.error.issues[0]?.message).toBe(
            'O hodômetro final deve ser maior que o inicial (10.000 km).',
          );
        }
      },
    );

    it('bloqueia o inicial menor que o último final no schema contextual e aceita o igual', () => {
      const base = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
      };

      const menor = abrirViagemComUltimoHodometroSchema(15000).safeParse({
        ...base,
        hodometro_inicial: 14000,
      });
      expect(menor.success).toBe(false);
      if (!menor.success) {
        expect(menor.error.issues[0]?.message).toBe(
          'O hodômetro inicial não pode ser menor que o último final (15.000 km).',
        );
        expect(menor.error.issues[0]?.path).toEqual(['hodometro_inicial']);
      }

      const igual = abrirViagemComUltimoHodometroSchema(15000).safeParse({
        ...base,
        hodometro_inicial: 15000,
      });
      expect(igual.success).toBe(true);
    });

    it.each([
      ['data_inicio', { ...{ veiculo_id: 'veic-1', rota_id: 'rota-1', motorista_id: 'mot-1', hodometro_inicial: 1000 }, data_inicio: '' }, 'Data de início inválida.'],
      ['data_fim', { hodometro_final: 1000, data_fim: '' }, 'Data de fim inválida.'],
    ] as const)('rejeita %s vazia no schema', (campo, input, mensagem) => {
      const resultado =
        campo === 'data_inicio'
          ? abrirViagemSchema.safeParse(input)
          : fecharViagemSchema.safeParse(input);

      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]?.message).toBe(mensagem);
      }
    });
  });

  describe('Leitura e escrita no SQLite do aparelho (EIX-41)', () => {
    const AGORA = '2026-10-18T10:00:00.000Z';
    let banco: BancoDeTeste;

    function semearVeiculo(id: string, status: local.Veiculo['status'] = 'Disponivel', placa = `PLC${id}`) {
      banco.db
        .insert(local.veiculo)
        .values({
          id,
          placa,
          marca: 'Scania',
          modelo: 'R450',
          capacidade_carga: 30,
          status,
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();
    }

    function semearRota(id: string, ativa = true, origem = 'São Paulo') {
      banco.db
        .insert(local.rota)
        .values({
          id,
          cidade_origem: origem,
          uf_origem: 'SP',
          cidade_destino: 'Curitiba',
          uf_destino: 'PR',
          distancia_estimada_km: 400,
          ativa,
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();
    }

    function semearViagem(dados: Partial<local.NovaViagem> & { id: string }) {
      banco.db
        .insert(local.viagem)
        .values({
          veiculo_id: 'veic-1',
          rota_id: 'rota-1',
          motorista_id: 'mot-1',
          hodometro_inicial: 10000,
          status: 'Finalizada',
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
          ...dados,
        })
        .run();
    }

    const outbox = () => banco.db.select().from(local.outbox).all();
    const statusDoVeiculo = (id: string) =>
      banco.db.select().from(local.veiculo).where(eq(local.veiculo.id, id)).get()?.status;

    const novaViagem = {
      veiculo_id: 'veic-1',
      rota_id: 'rota-1',
      motorista_id: 'mot-1',
      hodometro_inicial: 15000,
    };

    beforeEach(() => {
      banco = criarBancoDeTeste();
      setDb(banco.db as unknown as ViagensDb);
      semearVeiculo('veic-1');
      semearRota('rota-1');
    });

    afterEach(() => {
      banco.fechar();
    });

    it('abrirViagem grava a viagem, ocupa o veículo e enfileira o insert sem km_rodado', async () => {
      const resultado = await abrirViagem(novaViagem);

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      // UUID v7: o id nasce no aparelho (idempotência do sync).
      expect(resultado.data.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(resultado.data).toMatchObject({ status: 'EmAndamento', hodometro_final: null, km_rodado: null });

      const gravada = banco.db.select().from(local.viagem).where(eq(local.viagem.id, resultado.data.id)).get();
      expect(gravada).toEqual(resultado.data);
      expect(statusDoVeiculo('veic-1')).toBe('EmViagem');

      const fila = outbox();
      expect(fila).toHaveLength(1);
      expect(fila[0]).toMatchObject({ entidade: 'viagem', operacao: 'insert', situacao: 'pendente', tentativas: 0 });
      const payload = JSON.parse(fila[0]!.payload);
      expect(payload).toEqual({
        id: resultado.data.id,
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 15000,
        data_inicio: resultado.data.data_inicio,
        status: 'EmAndamento',
      });
      expect(payload).not.toHaveProperty('km_rodado');
    });

    it('abrirViagem usa o id recebido, para a tela poder repetir a mesma abertura', async () => {
      const resultado = await abrirViagem({ ...novaViagem, id: 'id-do-cliente' });

      expect(resultado.ok && resultado.data.id).toBe('id-do-cliente');
    });

    it.each([
      ['EmViagem', 'VG001'],
      ['EmManutencao', 'VG002'],
      ['Inativo', 'VG003'],
    ] as const)('abrirViagem barra veículo %s no aparelho (%s) sem gravar nada', async (status, codigo) => {
      semearVeiculo('veic-2', status);

      const resultado = await abrirViagem({ ...novaViagem, veiculo_id: 'veic-2' });

      expect(resultado).toEqual({ ok: false, mensagem: MENSAGENS_ERRO_VIAGEM[codigo], campo: 'veiculo_id', codigo });
      expect(banco.db.select().from(local.viagem).all()).toHaveLength(0);
      expect(outbox()).toHaveLength(0);
    });

    it('abrirViagem barra o veículo com viagem aberta no aparelho mesmo se o cache ainda diz Disponível (VG001)', async () => {
      semearViagem({ id: 'v-aberta', status: 'EmAndamento' });

      const resultado = await abrirViagem(novaViagem);

      expect(resultado).toMatchObject({ ok: false, codigo: 'VG001', campo: 'veiculo_id' });
      expect(outbox()).toHaveLength(0);
    });

    it('abrirViagem barra o hodômetro inicial menor que o último final do veículo (VG004) e aceita o igual', async () => {
      semearViagem({ id: 'v-antiga', hodometro_final: 15000 });

      expect(await abrirViagem({ ...novaViagem, hodometro_inicial: 14999 })).toMatchObject({
        ok: false,
        codigo: 'VG004',
        campo: 'hodometro_inicial',
        mensagem: MENSAGENS_ERRO_VIAGEM.VG004,
      });
      expect((await abrirViagem({ ...novaViagem, hodometro_inicial: 15000 })).ok).toBe(true);
    });

    it.each([
      ['veículo', { veiculo_id: 'veic-inexistente' }, MENSAGEM_VEICULO_FORA_DO_APARELHO, 'veiculo_id'],
      ['rota', { rota_id: 'rota-inexistente' }, MENSAGEM_ROTA_FORA_DO_APARELHO, 'rota_id'],
    ] as const)('abrirViagem explica quando o %s ainda não está no aparelho', async (_nome, troca, mensagem, campo) => {
      const resultado = await abrirViagem({ ...novaViagem, ...troca });

      expect(resultado).toEqual({ ok: false, mensagem, campo });
      expect(outbox()).toHaveLength(0);
    });

    it('abrirViagem devolve a mensagem do schema para dado inválido, sem tocar no banco', async () => {
      const resultado = await abrirViagem({ ...novaViagem, hodometro_inicial: -1 });

      expect(resultado).toEqual({
        ok: false,
        mensagem: 'O hodômetro inicial não pode ser negativo.',
        campo: 'hodometro_inicial',
      });
      expect(outbox()).toHaveLength(0);
    });

    it('fecharViagem conclui no aparelho, devolve o veículo e enfileira o update sem km_rodado', async () => {
      const aberta = await abrirViagem(novaViagem);
      if (!aberta.ok) throw new Error(aberta.mensagem);

      const resultado = await fecharViagem(aberta.data.id, { hodometro_final: 15400 });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data).toMatchObject({ status: 'Finalizada', hodometro_final: 15400, km_rodado: 400 });
      expect(banco.db.select().from(local.viagem).get()).toEqual(resultado.data);
      expect(statusDoVeiculo('veic-1')).toBe('Disponivel');

      const fila = outbox();
      expect(fila.map((item) => item.operacao)).toEqual(['insert', 'update']);
      const payload = JSON.parse(fila[1]!.payload);
      expect(payload).toEqual({
        id: aberta.data.id,
        status: 'Finalizada',
        hodometro_final: 15400,
        data_fim: resultado.data.data_fim,
      });
      expect(payload).not.toHaveProperty('km_rodado');
    });

    it('fecharViagem não devolve como Disponível o veículo inativado durante a viagem', async () => {
      semearViagem({ id: 'v-aberta', status: 'EmAndamento' });
      banco.db.update(local.veiculo).set({ status: 'Inativo' }).where(eq(local.veiculo.id, 'veic-1')).run();

      expect((await fecharViagem('v-aberta', { hodometro_final: 10500 })).ok).toBe(true);
      expect(statusDoVeiculo('veic-1')).toBe('Inativo');
    });

    it.each([
      ['já encerrada', 'v-fechada'],
      ['inexistente', 'v-que-nao-existe'],
    ])('fecharViagem não regrava viagem %s', async (_caso, id) => {
      semearViagem({ id: 'v-fechada', hodometro_final: 10300 });

      const resultado = await fecharViagem(id, { hodometro_final: 10500 });

      expect(resultado).toEqual({ ok: false, mensagem: MENSAGEM_VIAGEM_NAO_ABERTA, campo: 'status' });
      expect(banco.db.select().from(local.viagem).get()?.hodometro_final).toBe(10300);
      expect(outbox()).toHaveLength(0);
    });

    it.each([10000, 9999])('fecharViagem barra hodômetro final %i (não maior que o inicial)', async (final) => {
      semearViagem({ id: 'v-aberta', status: 'EmAndamento' });

      const resultado = await fecharViagem('v-aberta', { hodometro_final: final });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_hodometro_final_maior,
        campo: 'hodometro_final',
        codigo: '23514',
      });
      expect(outbox()).toHaveLength(0);
    });

    it('buscarViagemPorId junta veículo, rota e o nome do motorista do cache', async () => {
      semearViagem({ id: 'v1', hodometro_final: 10400 });
      banco.db.insert(local.motorista).values({ id: 'mot-1', nome: 'Carlos da Silva' }).run();

      const resultado = await buscarViagemPorId('v1');

      expect(resultado).toEqual({
        ok: true,
        data: expect.objectContaining({
          id: 'v1',
          veiculo: { id: 'veic-1', placa: 'PLCveic-1', marca: 'Scania', modelo: 'R450', status: 'Disponivel' },
          rota: expect.objectContaining({ id: 'rota-1', cidade_origem: 'São Paulo', distancia_estimada_km: 400 }),
          motorista: { id: 'mot-1', nome: 'Carlos da Silva' },
        }),
      });
      expect(await buscarViagemPorId('nao-existe')).toEqual({ ok: false, mensagem: 'Viagem não encontrada.' });
    });

    it('buscarViagemPorId devolve motorista nulo quando o nome ainda não veio do servidor', async () => {
      semearViagem({ id: 'v1' });

      const resultado = await buscarViagemPorId('v1');

      expect(resultado.ok && resultado.data.motorista).toBeNull();
    });

    it('buscarUltimoHodometro devolve o maior final do veículo, ou null', async () => {
      expect(await buscarUltimoHodometro('veic-1')).toEqual({ ok: true, data: null });

      semearViagem({ id: 'v1', hodometro_inicial: 10000, hodometro_final: 10400 });
      semearViagem({ id: 'v2', hodometro_inicial: 10400, hodometro_final: 10900 });
      semearViagem({ id: 'v3', hodometro_inicial: 10900, status: 'EmAndamento' });

      expect(await buscarUltimoHodometro('veic-1')).toEqual({ ok: true, data: 10900 });
    });

    it('listarRotasAtivas lê só as rotas ativas do aparelho, em ordem de origem', async () => {
      semearRota('rota-2', true, 'Campinas');
      semearRota('rota-3', false, 'Americana');

      const resultado = await listarRotasAtivas();

      expect(resultado.ok && resultado.data.map((rota) => rota.id)).toEqual(['rota-2', 'rota-1']);
    });

    it('listarVeiculosDisponiveis lê só os veículos Disponíveis do aparelho', async () => {
      semearVeiculo('veic-2', 'EmManutencao');
      semearVeiculo('veic-3', 'EmViagem');

      const resultado = await listarVeiculosDisponiveis();

      expect(resultado).toEqual({
        ok: true,
        data: [
          {
            id: 'veic-1',
            placa: 'PLCveic-1',
            marca: 'Scania',
            modelo: 'R450',
            ano_fabricacao: null,
            capacidade_carga: 30,
            status: 'Disponivel',
          },
        ],
      });
    });

    it('buscarVeiculo devolve o status do cache, ou explica que o veículo não está no aparelho', async () => {
      expect(await buscarVeiculo('veic-1')).toMatchObject({ ok: true, data: { status: 'Disponivel' } });
      expect(await buscarVeiculo('nao-existe')).toEqual({
        ok: false,
        mensagem: MENSAGEM_VEICULO_FORA_DO_APARELHO,
        campo: 'veiculo_id',
      });
    });

    it('listarViagens filtra por status e veículo e ordena da mais recente para a mais antiga', async () => {
      semearVeiculo('veic-2');
      semearViagem({ id: 'v-antiga', data_inclusao: '2026-10-01T00:00:00.000Z', hodometro_final: 10200 });
      semearViagem({ id: 'v-nova', data_inclusao: '2026-10-10T00:00:00.000Z', hodometro_final: 10300 });
      semearViagem({ id: 'v-aberta', veiculo_id: 'veic-2', status: 'EmAndamento' });

      const todas = await listarViagens();
      const concluidasVeic1 = await listarViagens({ status: 'Finalizada', veiculo_id: 'veic-1' });

      expect(todas.ok && todas.data.map((viagem) => viagem.id)).toEqual(['v-aberta', 'v-nova', 'v-antiga']);
      expect(concluidasVeic1.ok && concluidasVeic1.data.map((viagem) => viagem.id)).toEqual(['v-nova', 'v-antiga']);
    });
  });

  describe('Consultas que continuam online', () => {
    it('listarMotoristasAtivos filtra perfil Motorista e status Ativo no banco', async () => {
      const [builder] = responder(
        ok([{ id: 'mot-2', nome: 'João Motorista', email: 'joao@x.com', perfil: { nome: 'Motorista' } }]),
      );

      const resultado = await listarMotoristasAtivos();

      expect(resultado).toEqual({
        ok: true,
        data: [{ id: 'mot-2', nome: 'João Motorista', email: 'joao@x.com' }],
      });
      expect(mockFrom).toHaveBeenCalledWith('usuario');
      expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('perfil_id!inner'));
      expect(builder.eq).toHaveBeenCalledWith('status', 'Ativo');
      expect(builder.eq).toHaveBeenCalledWith('perfil.nome', 'Motorista');
    });

    it('listarMotoristasAtivos traduz o erro do banco', async () => {
      responder(erro('42501'));

      expect(await listarMotoristasAtivos()).toMatchObject({ ok: false, codigo: '42501' });
    });
  });

  it('viagensRepository implementa o contrato ViagensRepository', () => {
    const repo: ViagensRepository = viagensRepository;
    expect(repo.listarViagens).toBe(listarViagens);
    expect(repo.buscarViagemPorId).toBe(buscarViagemPorId);
    expect(repo.buscarUltimoHodometro).toBe(buscarUltimoHodometro);
    expect(repo.listarVeiculosDisponiveis).toBe(listarVeiculosDisponiveis);
    expect(repo.buscarVeiculo).toBe(buscarVeiculo);
    expect(repo.listarRotasAtivas).toBe(listarRotasAtivas);
    expect(repo.listarMotoristasAtivos).toBe(listarMotoristasAtivos);
    expect(repo.abrirViagem).toBe(abrirViagem);
    expect(repo.fecharViagem).toBe(fecharViagem);
  });
});
