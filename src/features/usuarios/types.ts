import type { Tables } from '@/types/database';

import type { PerfilNome, StatusUsuario } from '@/features/auth/permissions';

// Derivados dos tipos gerados por `supabase gen types typescript` (AGENTS.md §2.2).
export type Perfil = Pick<Tables<'perfil'>, 'id'> & { nome: PerfilNome };

// O perfil vem embutido pela relação usuario.perfil_id → perfil, numa única consulta.
export type Usuario = Pick<Tables<'usuario'>, 'id' | 'nome' | 'email'> & {
  status: StatusUsuario;
  perfil: Perfil;
};
