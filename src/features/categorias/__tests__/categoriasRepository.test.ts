import {
  atualizarCategoria,
  buscarCategoriaPorId,
  criarCategoria,
  definirAtivaCategoria,
  listarCategorias,
  resetCategoriasParaTeste,
} from '../categoriasRepository';

describe('categoriasRepository', () => {
  beforeEach(() => {
    resetCategoriasParaTeste();
  });

  it('lista as categorias padrão do seed já na primeira abertura', async () => {
    const resultado = await listarCategorias();

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.data.length).toBeGreaterThan(0);
    expect(resultado.data.every((categoria) => categoria.ativa)).toBe(true);
  });

  it('cria uma categoria nova e ela aparece na listagem', async () => {
    const criada = await criarCategoria({ titulo: 'Pneus', tipo: 'Saida' });
    expect(criada.ok).toBe(true);

    const resultado = await listarCategorias();
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.data.some((categoria) => categoria.titulo === 'Pneus')).toBe(true);
  });

  it('não permite criar com título duplicado (case-insensitive)', async () => {
    const resultado = await criarCategoria({ titulo: '  combustível  ', tipo: 'Saida' });

    expect(resultado).toEqual({ ok: false, mensagem: 'Já existe uma categoria com esse título.' });
  });

  it('atualiza título e tipo de uma categoria existente', async () => {
    const criada = await criarCategoria({ titulo: 'Pneus', tipo: 'Saida' });
    if (!criada.ok) throw new Error('setup falhou');

    const atualizada = await atualizarCategoria(criada.data.id, { titulo: 'Pneus e câmaras', tipo: 'Saida' });

    expect(atualizada).toEqual({ ok: true, data: { ...criada.data, titulo: 'Pneus e câmaras' } });
  });

  it('não permite atualizar para um título já usado por outra categoria', async () => {
    const criada = await criarCategoria({ titulo: 'Pneus', tipo: 'Saida' });
    if (!criada.ok) throw new Error('setup falhou');

    const resultado = await atualizarCategoria(criada.data.id, { titulo: 'Combustível', tipo: 'Saida' });

    expect(resultado).toEqual({ ok: false, mensagem: 'Já existe uma categoria com esse título.' });
  });

  it('desativa uma categoria (soft delete): ela some da listagem de ativas', async () => {
    const lista = await listarCategorias();
    if (!lista.ok) throw new Error('setup falhou');
    const alvo = lista.data[0];

    const desativada = await definirAtivaCategoria(alvo.id, false);
    expect(desativada).toEqual({ ok: true, data: { ...alvo, ativa: false } });

    const resultado = await listarCategorias();
    if (!resultado.ok) throw new Error('assert falhou');
    expect(resultado.data.find((categoria) => categoria.id === alvo.id)?.ativa).toBe(false);
  });

  it('busca uma categoria por id', async () => {
    const lista = await listarCategorias();
    if (!lista.ok) throw new Error('setup falhou');
    const alvo = lista.data[0];

    const resultado = await buscarCategoriaPorId(alvo.id);

    expect(resultado).toEqual({ ok: true, data: alvo });
  });

  it('retorna erro ao buscar um id inexistente', async () => {
    const resultado = await buscarCategoriaPorId('id-que-nao-existe');

    expect(resultado).toEqual({ ok: false, mensagem: 'Categoria não encontrada.' });
  });

  it('reativa uma categoria desativada', async () => {
    const lista = await listarCategorias();
    if (!lista.ok) throw new Error('setup falhou');
    const alvo = lista.data[0];
    await definirAtivaCategoria(alvo.id, false);

    const reativada = await definirAtivaCategoria(alvo.id, true);

    expect(reativada).toEqual({ ok: true, data: { ...alvo, ativa: true } });
  });
});
