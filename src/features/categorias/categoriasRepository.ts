import { z } from 'zod';

import { supabase } from '@/supabase/client';
import { Constants } from '@/types/database';

import type { Categoria, TipoCategoria } from './types';

// Camada de acesso a dados isolada da tela (AGENTS.md §2.3, skill supabase-query): as telas só
// conhecem estas funções e o formato `{ ok, data } | { ok: false, mensagem }`, nunca o Supabase.
// A autorização (Admin e Financeiro) é decidida pelas policies de RLS da tabela `categoria`.

export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

const COLUNAS = 'id, titulo, tipo, ativa';

// Catálogo pequeno por natureza; o limite só impede uma resposta sem teto (skill supabase-query).
const LIMITE_LISTA = 500;

const MENSAGEM_DUPLICADA = 'Já existe uma categoria com esse título.';
const MENSAGEM_NAO_ENCONTRADA = 'Categoria não encontrada.';
const MENSAGEM_DADOS_INVALIDOS = 'Os dados recebidos são inválidos. Tente novamente.';

// Dado externo não é confiável só porque o TypeScript compilou: a resposta passa pelo Zod.
// O enum vem de `Constants` (gerado), então acompanha o banco sem lista escrita à mão.
const categoriaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  tipo: z.enum(Constants.public.Enums.tipo_categoria),
  ativa: z.boolean(),
});

type ErroSupabase = { code: string };

// Nunca mostra `error.message` do Postgres ao usuário: traduz os códigos que a tela sabe explicar.
function traduzirErro(error: ErroSupabase, mensagemPadrao: string): string {
  // 23505 = unique_violation na constraint (titulo, tipo). Cobre a corrida entre a checagem
  // de duplicada abaixo e o insert/update, e devolve o mesmo erro de domínio para o campo.
  if (error.code === '23505') return MENSAGEM_DUPLICADA;
  // 42501 = insufficient_privilege: a policy de RLS recusou a escrita para este perfil.
  if (error.code === '42501') return 'Você não tem permissão para alterar categorias.';
  return mensagemPadrao;
}

function normalizarTitulo(titulo: string): string {
  return titulo.trim().toLowerCase();
}

// A constraint unique (titulo, tipo) do banco diferencia maiúsculas e não ignora espaços, então
// "combustível " passaria por ela. Esta checagem aplica a regra da US01 antes de gravar.
// Compara contra ativas E inativas: senão o usuário criaria uma segunda "Combustível" sem saber
// que já existe uma desativada — o caminho certo é reativá-la.
async function existeDuplicada(
  titulo: string,
  tipo: TipoCategoria,
  ignorarId?: string,
): Promise<Resultado<boolean>> {
  const { data, error } = await supabase.from('categoria').select('id, titulo').eq('tipo', tipo);

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível salvar a categoria. Tente novamente.') };
  }

  const normalizado = normalizarTitulo(titulo);
  const duplicada = data.some(
    (categoria) => categoria.id !== ignorarId && normalizarTitulo(categoria.titulo) === normalizado,
  );
  return { ok: true, data: duplicada };
}

function validarCategoria(data: unknown): Resultado<Categoria> {
  const parsed = categoriaSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }
  return { ok: true, data: parsed.data };
}

export async function buscarCategoriaPorId(id: string): Promise<Resultado<Categoria>> {
  const { data, error } = await supabase.from('categoria').select(COLUNAS).eq('id', id).maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar a categoria. Tente novamente.') };
  }
  // Sem linha também é o que o RLS devolve quando o perfil não pode ler: para a tela, "não encontrada".
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validarCategoria(data);
}

// Traz ativas e inativas: a tela filtra localmente com o switch "Mostrar desativadas".
export async function listarCategorias(): Promise<Resultado<Categoria[]>> {
  const { data, error } = await supabase
    .from('categoria')
    .select(COLUNAS)
    .order('titulo')
    .limit(LIMITE_LISTA);

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível carregar as categorias. Tente novamente.') };
  }

  const parsed = z.array(categoriaSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, mensagem: MENSAGEM_DADOS_INVALIDOS };
  }

  return { ok: true, data: parsed.data };
}

export async function criarCategoria(input: { titulo: string; tipo: TipoCategoria }): Promise<Resultado<Categoria>> {
  const duplicada = await existeDuplicada(input.titulo, input.tipo);
  if (!duplicada.ok) return duplicada;
  if (duplicada.data) {
    return { ok: false, mensagem: MENSAGEM_DUPLICADA };
  }

  // id gerado pelo banco (gen_random_uuid): categoria é online-only, não precisa de id offline.
  const { data, error } = await supabase
    .from('categoria')
    .insert({ titulo: input.titulo.trim(), tipo: input.tipo })
    .select(COLUNAS)
    .single();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível criar a categoria. Tente novamente.') };
  }

  return validarCategoria(data);
}

export async function atualizarCategoria(
  id: string,
  input: { titulo: string; tipo: TipoCategoria },
): Promise<Resultado<Categoria>> {
  // Ignora o próprio id: salvar sem mudar o título não pode contar como duplicada.
  const duplicada = await existeDuplicada(input.titulo, input.tipo, id);
  if (!duplicada.ok) return duplicada;
  if (duplicada.data) {
    return { ok: false, mensagem: MENSAGEM_DUPLICADA };
  }

  const { data, error } = await supabase
    .from('categoria')
    .update({ titulo: input.titulo.trim(), tipo: input.tipo })
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    return { ok: false, mensagem: traduzirErro(error, 'Não foi possível atualizar a categoria. Tente novamente.') };
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validarCategoria(data);
}

// Soft delete: alterna só a coluna `ativa` — nunca DELETE físico (AGENTS.md §2.4). A tabela
// nem tem policy de delete; categoria desativada continua nos lançamentos antigos.
export async function definirAtivaCategoria(id: string, ativa: boolean): Promise<Resultado<Categoria>> {
  const { data, error } = await supabase
    .from('categoria')
    .update({ ativa })
    .eq('id', id)
    .select(COLUNAS)
    .maybeSingle();

  if (error) {
    const acao = ativa ? 'reativar' : 'desativar';
    return { ok: false, mensagem: traduzirErro(error, `Não foi possível ${acao} a categoria. Tente novamente.`) };
  }
  if (!data) {
    return { ok: false, mensagem: MENSAGEM_NAO_ENCONTRADA };
  }

  return validarCategoria(data);
}
