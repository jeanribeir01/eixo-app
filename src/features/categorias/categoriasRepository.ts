import { z } from 'zod';

import type { Categoria, TipoCategoria } from './types';

// Camada de acesso a dados isolada da tela (AGENTS.md §2.3, skill supabase-query): a tabela
// `categoria` ainda não existe no Supabase (EIX-27 em andamento). Este módulo simula o client
// com um array em memória, mas cada função já tem a assinatura e o formato de retorno
// (`{ ok, data } | { ok: false, mensagem }`) que terá quando chamar `supabase.from('categoria')...`.
// Trocar a implementação aqui não deve exigir mudar nenhuma tela.

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

const categoriaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  tipo: z.enum(['Entrada', 'Saida']),
  ativa: z.boolean(),
});

// Categorias padrão do seed: aparecem já na primeira abertura (critério de aceite da EIX-28).
// Quando a migration da EIX-27 existir, este seed vira um INSERT na própria migration.
const SEED: Categoria[] = [
  { id: 'seed-1', titulo: 'Frete', tipo: 'Entrada', ativa: true },
  { id: 'seed-2', titulo: 'Outras entradas', tipo: 'Entrada', ativa: true },
  { id: 'seed-3', titulo: 'Combustível', tipo: 'Saida', ativa: true },
  { id: 'seed-4', titulo: 'Manutenção', tipo: 'Saida', ativa: true },
  { id: 'seed-5', titulo: 'Pedágio', tipo: 'Saida', ativa: true },
  { id: 'seed-6', titulo: 'Salário', tipo: 'Saida', ativa: true },
  { id: 'seed-7', titulo: 'Outras despesas', tipo: 'Saida', ativa: true },
];

function clonarLista(lista: Categoria[]): Categoria[] {
  return lista.map((categoria) => ({ ...categoria }));
}

let categorias: Categoria[] = clonarLista(SEED);

// Placeholder até a integração real com Supabase existir: o padrão do projeto é UUID v7 gerado
// no cliente (CLAUDE.md §5), o que exige escolher uma lib com o usuário (AGENTS.md §4). Enquanto
// os dados vivem só neste módulo, um id simples é suficiente.
function criarIdTemporario(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Duplicado é verificado contra TODAS as categorias, não só as ativas: senão o usuário criaria
// uma segunda "Combustível" sem saber que já existe uma desativada — o caminho certo é reativá-la.
function existeTitulo(titulo: string, ignorarId?: string): boolean {
  const normalizado = titulo.trim().toLowerCase();
  return categorias.some(
    (categoria) => categoria.id !== ignorarId && categoria.titulo.trim().toLowerCase() === normalizado,
  );
}

export async function buscarCategoriaPorId(id: string): Promise<Resultado<Categoria>> {
  const categoria = categorias.find((item) => item.id === id);
  if (!categoria) {
    return { ok: false, mensagem: 'Categoria não encontrada.' };
  }

  return { ok: true, data: { ...categoria } };
}

export async function listarCategorias(): Promise<Resultado<Categoria[]>> {
  const parsed = z.array(categoriaSchema).safeParse(categorias);
  if (!parsed.success) {
    return { ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' };
  }

  return { ok: true, data: clonarLista(parsed.data) };
}

export async function criarCategoria(input: { titulo: string; tipo: TipoCategoria }): Promise<Resultado<Categoria>> {
  if (existeTitulo(input.titulo)) {
    return { ok: false, mensagem: 'Já existe uma categoria com esse título.' };
  }

  const nova: Categoria = { id: criarIdTemporario(), titulo: input.titulo.trim(), tipo: input.tipo, ativa: true };
  categorias = [...categorias, nova];
  return { ok: true, data: { ...nova } };
}

export async function atualizarCategoria(
  id: string,
  input: { titulo: string; tipo: TipoCategoria },
): Promise<Resultado<Categoria>> {
  const existente = categorias.find((categoria) => categoria.id === id);
  if (!existente) {
    return { ok: false, mensagem: 'Categoria não encontrada.' };
  }
  if (existeTitulo(input.titulo, id)) {
    return { ok: false, mensagem: 'Já existe uma categoria com esse título.' };
  }

  const atualizada: Categoria = { ...existente, titulo: input.titulo.trim(), tipo: input.tipo };
  categorias = categorias.map((categoria) => (categoria.id === id ? atualizada : categoria));
  return { ok: true, data: { ...atualizada } };
}

// Alterna ativa/inativa — nunca DELETE físico (AGENTS.md §2.4, §"Regras de dados não negociáveis").
export async function definirAtivaCategoria(id: string, ativa: boolean): Promise<Resultado<Categoria>> {
  const existente = categorias.find((categoria) => categoria.id === id);
  if (!existente) {
    return { ok: false, mensagem: 'Categoria não encontrada.' };
  }

  const atualizada: Categoria = { ...existente, ativa };
  categorias = categorias.map((categoria) => (categoria.id === id ? atualizada : categoria));
  return { ok: true, data: { ...atualizada } };
}

// Só para teste: o array vive no módulo, então cada arquivo de teste precisa de um estado limpo.
export function resetCategoriasParaTeste(): void {
  categorias = clonarLista(SEED);
}
