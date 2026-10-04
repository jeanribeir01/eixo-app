import {
  atualizarCategoria,
  buscarCategoriaPorId,
  criarCategoria,
  definirAtivaCategoria,
  listarCategorias,
} from '../categoriasRepository';

// Nenhum teste chama o banco real: o client é trocado por um query builder falso. Cada chamada a
// `supabase.from()` consome a próxima resposta da fila e devolve um builder que registra os métodos
// chamados, para os testes afirmarem sobre a query montada (ex.: update em vez de delete).
type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'maybeSingle'] as const;
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

// Enfileira as respostas na ordem das chamadas a `from()` e devolve os builders para asserção.
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

const frete = { id: '1', titulo: 'Frete', tipo: 'Entrada', ativa: true };
const combustivel = { id: '2', titulo: 'Combustível', tipo: 'Saida', ativa: true };
const antiga = { id: '3', titulo: 'Categoria antiga', tipo: 'Saida', ativa: false };

describe('categoriasRepository', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('listarCategorias', () => {
    it('lista ativas e inativas da tabela categoria, ordenadas por título', async () => {
      const [query] = responder(ok([frete, combustivel, antiga]));

      const resultado = await listarCategorias();

      expect(resultado).toEqual({ ok: true, data: [frete, combustivel, antiga] });
      expect(mockFrom).toHaveBeenCalledWith('categoria');
      expect(query.select).toHaveBeenCalledWith('id, titulo, tipo, ativa');
      expect(query.order).toHaveBeenCalledWith('titulo');
      expect(query.eq).not.toHaveBeenCalled();
    });

    it('lista vazia é sucesso, não erro', async () => {
      responder(ok([]));

      expect(await listarCategorias()).toEqual({ ok: true, data: [] });
    });

    it('erro do Supabase vira mensagem em português, sem detalhe técnico', async () => {
      responder(erro('PGRST301'));

      expect(await listarCategorias()).toEqual({
        ok: false,
        mensagem: 'Não foi possível carregar as categorias. Tente novamente.',
      });
    });

    it('resposta fora do formato esperado é rejeitada pelo Zod', async () => {
      responder(ok([{ ...frete, tipo: 'Saída' }]));

      expect(await listarCategorias()).toEqual({
        ok: false,
        mensagem: 'Os dados recebidos são inválidos. Tente novamente.',
      });
    });
  });

  describe('buscarCategoriaPorId', () => {
    it('busca a categoria pelo id', async () => {
      const [query] = responder(ok(combustivel));

      expect(await buscarCategoriaPorId('2')).toEqual({ ok: true, data: combustivel });
      expect(query.eq).toHaveBeenCalledWith('id', '2');
    });

    it('retorna "não encontrada" quando não há linha', async () => {
      responder(ok(null));

      expect(await buscarCategoriaPorId('inexistente')).toEqual({ ok: false, mensagem: 'Categoria não encontrada.' });
    });
  });

  describe('criarCategoria', () => {
    it('caminho feliz: grava o título sem espaços nas pontas e devolve a categoria criada', async () => {
      const pneus = { id: '10', titulo: 'Pneus', tipo: 'Saida', ativa: true };
      const [checagem, insercao] = responder(ok([combustivel, antiga]), ok(pneus));

      const resultado = await criarCategoria({ titulo: '  Pneus  ', tipo: 'Saida' });

      expect(resultado).toEqual({ ok: true, data: pneus });
      expect(checagem.eq).toHaveBeenCalledWith('tipo', 'Saida');
      expect(insercao.insert).toHaveBeenCalledWith({ titulo: 'Pneus', tipo: 'Saida' });
    });

    it('não permite duplicada ignorando maiúsculas e espaços nas pontas', async () => {
      responder(ok([combustivel]));

      const resultado = await criarCategoria({ titulo: '  COMBUSTÍVEL ', tipo: 'Saida' });

      expect(resultado).toEqual({ ok: false, mensagem: 'Já existe uma categoria com esse título.' });
      // Só a checagem rodou: nenhum insert chegou ao banco.
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('considera também as desativadas na checagem de duplicada', async () => {
      const [checagem] = responder(ok([antiga]));

      const resultado = await criarCategoria({ titulo: 'categoria antiga', tipo: 'Saida' });

      expect(resultado).toEqual({ ok: false, mensagem: 'Já existe uma categoria com esse título.' });
      expect(checagem.eq).not.toHaveBeenCalledWith('ativa', expect.anything());
    });

    it('permite o mesmo título com o outro tipo (duplicidade é título + tipo)', async () => {
      const combustivelEntrada = { id: '11', titulo: 'Combustível', tipo: 'Entrada', ativa: true };
      const [checagem] = responder(ok([frete]), ok(combustivelEntrada));

      const resultado = await criarCategoria({ titulo: 'Combustível', tipo: 'Entrada' });

      expect(resultado).toEqual({ ok: true, data: combustivelEntrada });
      expect(checagem.eq).toHaveBeenCalledWith('tipo', 'Entrada');
    });

    it('traduz o erro 23505 do Postgres para o mesmo erro de duplicada', async () => {
      responder(ok([]), erro('23505'));

      expect(await criarCategoria({ titulo: 'Pneus', tipo: 'Saida' })).toEqual({
        ok: false,
        mensagem: 'Já existe uma categoria com esse título.',
      });
    });

    it('traduz o erro 42501 (RLS) para falta de permissão', async () => {
      responder(ok([]), erro('42501'));

      expect(await criarCategoria({ titulo: 'Pneus', tipo: 'Saida' })).toEqual({
        ok: false,
        mensagem: 'Você não tem permissão para alterar categorias.',
      });
    });

    it('erro desconhecido vira mensagem genérica em português', async () => {
      responder(ok([]), erro('XX000'));

      expect(await criarCategoria({ titulo: 'Pneus', tipo: 'Saida' })).toEqual({
        ok: false,
        mensagem: 'Não foi possível criar a categoria. Tente novamente.',
      });
    });
  });

  describe('atualizarCategoria', () => {
    it('atualiza título e tipo da categoria certa', async () => {
      const atualizada = { ...combustivel, titulo: 'Combustível diesel' };
      const [, atualizacao] = responder(ok([combustivel]), ok(atualizada));

      const resultado = await atualizarCategoria('2', { titulo: ' Combustível diesel ', tipo: 'Saida' });

      expect(resultado).toEqual({ ok: true, data: atualizada });
      expect(atualizacao.update).toHaveBeenCalledWith({ titulo: 'Combustível diesel', tipo: 'Saida' });
      expect(atualizacao.eq).toHaveBeenCalledWith('id', '2');
    });

    it('salvar sem mudar o título não conta a própria categoria como duplicada', async () => {
      responder(ok([combustivel]), ok(combustivel));

      expect(await atualizarCategoria('2', { titulo: 'combustível', tipo: 'Saida' })).toEqual({
        ok: true,
        data: combustivel,
      });
    });

    it('não permite usar o título de outra categoria do mesmo tipo', async () => {
      responder(ok([combustivel, antiga]));

      expect(await atualizarCategoria('2', { titulo: 'Categoria Antiga', tipo: 'Saida' })).toEqual({
        ok: false,
        mensagem: 'Já existe uma categoria com esse título.',
      });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('retorna "não encontrada" quando o update não afeta nenhuma linha', async () => {
      responder(ok([]), ok(null));

      expect(await atualizarCategoria('inexistente', { titulo: 'Pneus', tipo: 'Saida' })).toEqual({
        ok: false,
        mensagem: 'Categoria não encontrada.',
      });
    });
  });

  describe('definirAtivaCategoria (soft delete)', () => {
    it('desativar é update da coluna ativa, nunca delete', async () => {
      const [query] = responder(ok({ ...frete, ativa: false }));

      const resultado = await definirAtivaCategoria('1', false);

      expect(resultado).toEqual({ ok: true, data: { ...frete, ativa: false } });
      expect(query.update).toHaveBeenCalledWith({ ativa: false });
      expect(query.eq).toHaveBeenCalledWith('id', '1');
      expect(query.delete).not.toHaveBeenCalled();
    });

    it('reativar é update da coluna ativa para true', async () => {
      const [query] = responder(ok({ ...antiga, ativa: true }));

      const resultado = await definirAtivaCategoria('3', true);

      expect(resultado).toEqual({ ok: true, data: { ...antiga, ativa: true } });
      expect(query.update).toHaveBeenCalledWith({ ativa: true });
      expect(query.delete).not.toHaveBeenCalled();
    });

    it('erro ao desativar vira mensagem em português', async () => {
      responder(erro('XX000'));

      expect(await definirAtivaCategoria('1', false)).toEqual({
        ok: false,
        mensagem: 'Não foi possível desativar a categoria. Tente novamente.',
      });
    });
  });
});
