import type { Enums, Tables } from '@/types/database';

// Derivados dos tipos gerados por `supabase gen types typescript` — nunca digite o tipo de
// tabela na mão (AGENTS.md §2.2, CLAUDE.md §12).
export type TipoCategoria = Enums<'tipo_categoria'>;

// Só as colunas que a tela usa; data_inclusao/data_atualizacao ficam no banco.
export type Categoria = Pick<Tables<'categoria'>, 'id' | 'titulo' | 'tipo' | 'ativa'>;

// O enum do banco não tem acento ('Saida'); o acento existe só no que o usuário lê.
export const rotuloTipoCategoria: Record<TipoCategoria, string> = {
  Entrada: 'Entrada',
  Saida: 'Saída',
};
