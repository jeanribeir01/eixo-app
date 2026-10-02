import { atualizarVeiculo, buscarVeiculoPorId, criarVeiculo, listarVeiculos } from '../repository';
import type { VeiculoInput } from '../types';

// Nenhum teste chama o banco real: o client é trocado por um query builder falso (mesmo molde de
// categoriasRepository.test.ts). Cada `supabase.from()` consome a próxima resposta da fila e
// devolve um builder que registra os métodos chamados, para afirmar sobre a query montada.
type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'insert', 'update', 'delete', 'eq', 'or', 'order', 'limit', 'single', 'maybeSingle'] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function criarBuilder(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
    // A query do supabase-js é "thenable": `await` direto no builder devolve a resposta.
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
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

const COLUNAS = 'id, placa, marca, modelo, capacidade_carga, status';

const volvo = { id: '1', placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', capacidade_carga: 12.5, status: 'Disponivel' };
const scania = { id: '2', placa: 'DEF1G23', marca: 'Scania', modelo: 'R 450', capacidade_carga: 30, status: 'EmViagem' };

function input(sobrescreve: Partial<VeiculoInput> = {}): VeiculoInput {
  return { placa: 'ABC1234', marca: 'Volvo', modelo: 'FH 540', capacidade_carga: 12.5, status: 'Disponivel', ...sobrescreve };
}

describe('veiculos/repository', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('listarVeiculos', () => {
    it('lista da tabela veiculo com colunas explícitas, ordenada e com limite', async () => {
      const [query] = responder(ok([volvo, scania]));

      const resultado = await listarVeiculos();

      expect(resultado).toEqual({ ok: true, data: [volvo, scania] });
      expect(mockFrom).toHaveBeenCalledWith('veiculo');
      expect(query.select).toHaveBeenCalledWith(COLUNAS);
      expect(query.order).toHaveBeenCalledWith('placa');
      expect(query.limit).toHaveBeenCalled();
      expect(query.eq).not.toHaveBeenCalled();
      expect(query.or).not.toHaveBeenCalled();
    });

    it('lista vazia é sucesso, não erro', async () => {
      responder(ok([]));

      expect(await listarVeiculos()).toEqual({ ok: true, data: [] });
    });

    it('filtra por status no banco', async () => {
      const [query] = responder(ok([scania]));

      await listarVeiculos({ status: 'EmViagem' });

      expect(query.eq).toHaveBeenCalledWith('status', 'EmViagem');
    });

    it('busca por placa normalizada OU modelo', async () => {
      const [query] = responder(ok([volvo]));

      await listarVeiculos({ busca: 'abc-12' });

      expect(query.or).toHaveBeenCalledWith('placa.ilike.%ABC12%,modelo.ilike.%abc-12%');
    });

    it('remove da busca os caracteres que quebrariam o filtro .or() do PostgREST', async () => {
      const [query] = responder(ok([]));

      await listarVeiculos({ busca: 'fh,540)' });

      expect(query.or).toHaveBeenCalledWith('placa.ilike.%FH540%,modelo.ilike.%fh 540%');
    });

    it('busca só com símbolos não aplica filtro', async () => {
      const [query] = responder(ok([]));

      await listarVeiculos({ busca: ',()' });

      expect(query.or).not.toHaveBeenCalled();
    });

    it('erro do Supabase vira mensagem em português, sem detalhe técnico', async () => {
      responder(erro('PGRST301'));

      const resultado = await listarVeiculos();

      expect(resultado).toEqual({ ok: false, mensagem: 'Não foi possível carregar os veículos. Tente novamente.' });
    });

    it('resposta fora do formato esperado é rejeitada pelo Zod', async () => {
      responder(ok([{ ...volvo, status: 'Inativo' }]));

      expect(await listarVeiculos()).toEqual({ ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' });
    });
  });

  describe('buscarVeiculoPorId', () => {
    it('devolve o veículo encontrado', async () => {
      const [query] = responder(ok(volvo));

      expect(await buscarVeiculoPorId('1')).toEqual({ ok: true, data: volvo });
      expect(query.eq).toHaveBeenCalledWith('id', '1');
    });

    it('sem linha vira "Veículo não encontrado."', async () => {
      responder(ok(null));

      expect(await buscarVeiculoPorId('x')).toEqual({ ok: false, mensagem: 'Veículo não encontrado.' });
    });
  });

  describe('criarVeiculo', () => {
    it('envia a placa normalizada (maiúscula, sem hífen e sem espaço)', async () => {
      const [query] = responder(ok(volvo));

      const resultado = await criarVeiculo(input({ placa: 'abc - 1234', marca: ' Volvo ' }));

      expect(resultado).toEqual({ ok: true, data: volvo });
      expect(query.insert).toHaveBeenCalledWith({
        placa: 'ABC1234',
        marca: 'Volvo',
        modelo: 'FH 540',
        capacidade_carga: 12.5,
        status: 'Disponivel',
      });
      expect(query.select).toHaveBeenCalledWith(COLUNAS);
    });

    it('placa duplicada (23505) vira erro de domínio no campo placa, nunca erro cru', async () => {
      responder(erro('23505'));

      const resultado = await criarVeiculo(input());

      expect(resultado).toEqual({
        ok: false,
        mensagem: 'Já existe um veículo cadastrado com essa placa.',
        campo: 'placa',
      });
    });

    it('violação do check de formato (23514) vira "Placa inválida" no campo placa', async () => {
      responder(erro('23514'));

      const resultado = await criarVeiculo(input());

      expect(resultado).toMatchObject({ ok: false, campo: 'placa' });
      expect(!resultado.ok && resultado.mensagem).toMatch(/^Placa inválida/);
    });

    it('RLS recusando (42501) vira mensagem de permissão', async () => {
      responder(erro('42501'));

      expect(await criarVeiculo(input())).toEqual({ ok: false, mensagem: 'Você não tem permissão para alterar veículos.' });
    });
  });

  describe('atualizarVeiculo', () => {
    it('atualiza pelo id com a placa normalizada', async () => {
      const [query] = responder(ok({ ...volvo, modelo: 'FH 460' }));

      const resultado = await atualizarVeiculo('1', input({ placa: 'abc-1234', modelo: 'FH 460' }));

      expect(resultado).toEqual({ ok: true, data: { ...volvo, modelo: 'FH 460' } });
      expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ placa: 'ABC1234', modelo: 'FH 460' }));
      expect(query.eq).toHaveBeenCalledWith('id', '1');
      expect(query.delete).not.toHaveBeenCalled();
    });

    it('trocar para a placa de outro veículo é bloqueado com mensagem no campo', async () => {
      responder(erro('23505'));

      expect(await atualizarVeiculo('2', input())).toMatchObject({ ok: false, campo: 'placa' });
    });

    it('sem linha atualizada vira "Veículo não encontrado."', async () => {
      responder(ok(null));

      expect(await atualizarVeiculo('x', input())).toEqual({ ok: false, mensagem: 'Veículo não encontrado.' });
    });
  });
});
