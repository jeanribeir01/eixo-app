// Tipo de domínio escrito à mão porque a tabela `categoria` ainda não existe no Supabase
// (EIX-27 em andamento). Quando a migration subir, troque por
// `Database['public']['Tables']['categoria']['Row']` gerado por `supabase gen types typescript`
// — nunca digite o tipo de tabela na mão a partir daí (AGENTS.md §2.2, CLAUDE.md §12).
export type TipoCategoria = 'Entrada' | 'Saida';

export type Categoria = {
  id: string;
  titulo: string;
  tipo: TipoCategoria;
  ativa: boolean;
};
