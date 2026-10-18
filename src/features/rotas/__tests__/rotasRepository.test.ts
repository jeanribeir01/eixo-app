import { atualizarRota, buscarRotaPorId, criarRota, definirAtivaRota, listarRotas } from '../rotasRepository';
import type { RotaInput } from '../types';

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

const COLUNAS = 'id, cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km, ativa';

const curitibaSp = {
  id: 'r1',
  cidade_origem: 'Curitiba',
  uf_origem: 'PR',
  cidade_destino: 'São Paulo',
  uf_destino: 'SP',
  distancia_estimada_km: 408,
  ativa: true,
};
const londrinaSp = { ...curitibaSp, id: 'r2', cidade_origem: 'Londrina', distancia_estimada_km: 540.5, ativa: false };

const novaRota: RotaInput = {
  cidade_origem: 'Curitiba',
  uf_origem: 'PR',
  cidade_destino: 'São Paulo',
  uf_destino: 'SP',
  distancia_estimada_km: 408,
};

// O que a checagem de duplicada lê do banco: só id, cidades e `ativa`.
const trecho = ({ id, cidade_origem, cidade_destino, ativa }: typeof curitibaSp) => ({
  id,
  cidade_origem,
  cidade_destino,
  ativa,
});

const MENSAGEM_DUPLICADA = 'Já existe uma rota com esse trecho.';

describe('rotasRepository', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('listarRotas', () => {
    // ROTA-18: a contagem é do banco e só de viagens finalizadas.
    it('pede a contagem de viagens finalizadas no embed e devolve a contagem na rota', async () => {
      const [query] = responder(
        ok([
          { ...curitibaSp, viagem: [{ count: 3 }] },
          { ...londrinaSp, viagem: [{ count: 0 }] },
        ]),
      );

      const resultado = await listarRotas();

      expect(resultado).toEqual({
        ok: true,
        data: [
          { ...curitibaSp, viagens_finalizadas: 3 },
          { ...londrinaSp, viagens_finalizadas: 0 },
        ],
      });
      expect(mockFrom).toHaveBeenCalledWith('rota');
      expect(query.select).toHaveBeenCalledWith(`${COLUNAS}, viagem(count)`);
      expect(query.eq).toHaveBeenCalledWith('viagem.status', 'Finalizada');
      // Ativas e inativas: o filtro de inativas é da tela.
      expect(query.eq).not.toHaveBeenCalledWith('ativa', expect.anything());
      expect(query.order).toHaveBeenCalledWith('cidade_origem');
      expect(query.limit).toHaveBeenCalledWith(500);
    });

    it('rota sem linha no embed conta zero viagens', async () => {
      responder(ok([{ ...curitibaSp, viagem: [] }]));

      expect(await listarRotas()).toEqual({ ok: true, data: [{ ...curitibaSp, viagens_finalizadas: 0 }] });
    });

    it('lista vazia é sucesso, não erro', async () => {
      responder(ok([]));

      expect(await listarRotas()).toEqual({ ok: true, data: [] });
    });

    it('erro do Supabase vira mensagem em português, sem detalhe técnico', async () => {
      responder(erro('PGRST301'));

      expect(await listarRotas()).toEqual({ ok: false, mensagem: 'Não foi possível carregar as rotas. Tente novamente.' });
    });

    // ROTA-29
    it('resposta fora do formato esperado é rejeitada pelo Zod', async () => {
      responder(ok([{ ...curitibaSp, uf_origem: 'Paraná', viagem: [{ count: 1 }] }]));

      expect(await listarRotas()).toEqual({ ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' });
    });
  });

  describe('buscarRotaPorId', () => {
    it('busca a rota pelo id', async () => {
      const [query] = responder(ok(curitibaSp));

      expect(await buscarRotaPorId('r1')).toEqual({ ok: true, data: curitibaSp });
      expect(query.select).toHaveBeenCalledWith(COLUNAS);
      expect(query.eq).toHaveBeenCalledWith('id', 'r1');
    });

    // ROTA-28: id inexistente ou escondido pelo RLS.
    it('retorna "Rota não encontrada." quando não há linha', async () => {
      responder(ok(null));

      expect(await buscarRotaPorId('inexistente')).toEqual({ ok: false, mensagem: 'Rota não encontrada.' });
    });
  });

  describe('criarRota', () => {
    it('caminho feliz: grava as cidades limpas e devolve a rota criada', async () => {
      const [checagem, insercao] = responder(ok([]), ok(curitibaSp));

      const resultado = await criarRota({ ...novaRota, cidade_origem: '  Curitiba ', cidade_destino: 'São   Paulo' });

      expect(resultado).toEqual({ ok: true, data: curitibaSp });
      // As UFs filtram no banco; a cidade é comparada no cliente.
      expect(checagem.eq).toHaveBeenCalledWith('uf_origem', 'PR');
      expect(checagem.eq).toHaveBeenCalledWith('uf_destino', 'SP');
      expect(insercao.insert).toHaveBeenCalledWith(novaRota);
      expect(insercao.select).toHaveBeenCalledWith(COLUNAS);
    });

    // ROTA-10
    it('recusa trecho igual a uma rota ativa, sem chegar ao insert', async () => {
      responder(ok([trecho(curitibaSp)]));

      expect(await criarRota(novaRota)).toEqual({ ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    // ROTA-11
    it('considera igual a cidade que só difere por maiúscula, espaço ou acento', async () => {
      responder(ok([trecho(curitibaSp)]));

      const resultado = await criarRota({ ...novaRota, cidade_origem: ' CURITIBA ', cidade_destino: 'sao  paulo' });

      expect(resultado).toEqual({ ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' });
    });

    // ROTA-13: rota inativa também bloqueia, e a falha leva o id para o "Reativar rota existente".
    it('recusa trecho igual a uma rota inativa e devolve o id dela para reativar', async () => {
      responder(ok([trecho(londrinaSp)]));

      const resultado = await criarRota({ ...novaRota, cidade_origem: 'Londrina' });

      expect(resultado).toEqual({
        ok: false,
        mensagem: 'Já existe uma rota inativa com esse trecho. Reative-a para usar de novo.',
        campo: 'trecho',
        rotaInativaId: 'r2',
      });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    // ROTA-12: o sentido importa.
    it('aceita o trecho inverso de uma rota existente', async () => {
      const spCuritiba = { ...curitibaSp, id: 'r3', cidade_origem: 'São Paulo', uf_origem: 'SP', cidade_destino: 'Curitiba', uf_destino: 'PR' };
      // O banco já filtrou por uf_origem = SP e uf_destino = PR; a lista volta sem Curitiba → São Paulo.
      const [checagem, insercao] = responder(ok([]), ok(spCuritiba));

      const resultado = await criarRota({
        cidade_origem: 'São Paulo',
        uf_origem: 'SP',
        cidade_destino: 'Curitiba',
        uf_destino: 'PR',
        distancia_estimada_km: 408,
      });

      expect(resultado).toEqual({ ok: true, data: spCuritiba });
      expect(checagem.eq).toHaveBeenCalledWith('uf_origem', 'SP');
      expect(insercao.insert).toHaveBeenCalled();
    });

    it('aceita a mesma cidade de origem com destino diferente', async () => {
      const curitibaCampinas = { ...curitibaSp, id: 'r4', cidade_destino: 'Campinas' };
      responder(ok([trecho(curitibaSp)]), ok(curitibaCampinas));

      expect(await criarRota({ ...novaRota, cidade_destino: 'Campinas' })).toEqual({ ok: true, data: curitibaCampinas });
    });

    // ROTA-16: corrida entre a checagem e o insert.
    it('traduz o 23505 de rota_trecho_unico para a mesma mensagem de duplicada', async () => {
      responder(ok([]), erro('23505'));

      expect(await criarRota(novaRota)).toEqual({ ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' });
    });

    // ROTA-29
    it('traduz o 23514 da check de cidade', async () => {
      responder(ok([]), erro('23514'));

      expect(await criarRota(novaRota)).toEqual({
        ok: false,
        mensagem: 'Cidade inválida. Revise os nomes de origem e destino.',
      });
    });

    it('traduz o 42501 (RLS) para acesso negado', async () => {
      responder(ok([]), erro('42501'));

      expect(await criarRota(novaRota)).toEqual({
        ok: false,
        mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.',
      });
    });

    it('erro desconhecido vira mensagem genérica em português', async () => {
      responder(ok([]), erro('XX000'));

      expect(await criarRota(novaRota)).toEqual({ ok: false, mensagem: 'Não foi possível cadastrar a rota. Tente novamente.' });
    });

    it('erro na checagem de duplicada não tenta gravar', async () => {
      responder(erro('PGRST301'));

      expect(await criarRota(novaRota)).toEqual({ ok: false, mensagem: 'Não foi possível salvar a rota. Tente novamente.' });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('resposta inválida do insert é rejeitada pelo Zod', async () => {
      responder(ok([]), ok({ ...curitibaSp, distancia_estimada_km: '408' }));

      expect(await criarRota(novaRota)).toEqual({ ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' });
    });
  });

  describe('atualizarRota', () => {
    it('atualiza a rota certa com as cidades limpas', async () => {
      const atualizada = { ...curitibaSp, distancia_estimada_km: 410 };
      const [, atualizacao] = responder(ok([trecho(curitibaSp)]), ok(atualizada));

      const resultado = await atualizarRota('r1', { ...novaRota, cidade_origem: ' Curitiba', distancia_estimada_km: 410 });

      expect(resultado).toEqual({ ok: true, data: atualizada });
      expect(atualizacao.update).toHaveBeenCalledWith({ ...novaRota, distancia_estimada_km: 410 });
      expect(atualizacao.eq).toHaveBeenCalledWith('id', 'r1');
    });

    // ROTA-15
    it('salvar sem mudar o trecho não conta a própria rota como duplicada', async () => {
      responder(ok([trecho(curitibaSp)]), ok(curitibaSp));

      expect(await atualizarRota('r1', novaRota)).toEqual({ ok: true, data: curitibaSp });
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it('recusa editar para o trecho de outra rota', async () => {
      responder(ok([trecho(curitibaSp)]));

      expect(await atualizarRota('r9', novaRota)).toEqual({ ok: false, mensagem: MENSAGEM_DUPLICADA, campo: 'trecho' });
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('retorna "Rota não encontrada." quando o update não acha linha', async () => {
      responder(ok([]), ok(null));

      expect(await atualizarRota('inexistente', novaRota)).toEqual({ ok: false, mensagem: 'Rota não encontrada.' });
    });

    it('erro desconhecido vira mensagem genérica em português', async () => {
      responder(ok([]), erro('XX000'));

      expect(await atualizarRota('r1', novaRota)).toEqual({
        ok: false,
        mensagem: 'Não foi possível atualizar a rota. Tente novamente.',
      });
    });
  });

  describe('definirAtivaRota', () => {
    // ROTA-21: soft delete, nunca DELETE.
    it('inativa com update da coluna ativa, nunca delete', async () => {
      const inativa = { ...curitibaSp, ativa: false };
      const [query] = responder(ok(inativa));

      expect(await definirAtivaRota('r1', false)).toEqual({ ok: true, data: inativa });
      expect(query.update).toHaveBeenCalledWith({ ativa: false });
      expect(query.eq).toHaveBeenCalledWith('id', 'r1');
      expect(query.delete).not.toHaveBeenCalled();
    });

    // ROTA-14, ROTA-22
    it('reativa a rota', async () => {
      const [query] = responder(ok({ ...londrinaSp, ativa: true }));

      expect(await definirAtivaRota('r2', true)).toEqual({ ok: true, data: { ...londrinaSp, ativa: true } });
      expect(query.update).toHaveBeenCalledWith({ ativa: true });
    });

    it('erro vira mensagem com a ação certa', async () => {
      responder(erro('XX000'), erro('XX000'));

      expect(await definirAtivaRota('r1', false)).toEqual({ ok: false, mensagem: 'Não foi possível inativar a rota. Tente novamente.' });
      expect(await definirAtivaRota('r1', true)).toEqual({ ok: false, mensagem: 'Não foi possível reativar a rota. Tente novamente.' });
    });

    it('traduz o 42501 (RLS) para acesso negado', async () => {
      responder(erro('42501'));

      expect(await definirAtivaRota('r1', false)).toEqual({
        ok: false,
        mensagem: 'Acesso negado. Seu perfil não tem permissão para esta ação.',
      });
    });

    it('retorna "Rota não encontrada." quando o update não acha linha', async () => {
      responder(ok(null));

      expect(await definirAtivaRota('inexistente', true)).toEqual({ ok: false, mensagem: 'Rota não encontrada.' });
    });
  });
});
