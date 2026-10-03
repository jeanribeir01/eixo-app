import type { Enums } from '@/types/database';

// Regras de acesso do app num lugar só (US16). As US17 (navegação) e US18 consomem estas
// funções via `useProfile()` em vez de comparar nome de perfil em cada tela.
// Lembrete (CLAUDE.md §7): o cliente esconde, o RLS decide. Isto é usabilidade, não segurança.

export type PerfilNome = Enums<'perfil_nome'>;
export type StatusUsuario = Enums<'status_usuario'>;

// O mínimo que as regras precisam saber do usuário logado.
export type PerfilDoUsuario = { perfil: PerfilNome; status: StatusUsuario };

// O enum do banco segue o MER (`Admin`, `Motorista`); o nome completo existe só no que o usuário lê.
export const rotuloPerfil: Record<PerfilNome, string> = {
  Admin: 'Administrador',
  'Gestor de Frota': 'Gestor de Frota',
  Financeiro: 'Financeiro',
  Motorista: 'Operador/Motorista',
};

export const rotuloStatus: Record<StatusUsuario, string> = {
  AguardandoAprovacao: 'Aguardando aprovação',
  Ativo: 'Ativo',
  Bloqueado: 'Bloqueado',
};

// Fecha por padrão: sem usuário, ou com status diferente de Ativo, nenhuma permissão vale —
// o mesmo que `auth_perfil()` faz no banco.
export function isAprovado(usuario: PerfilDoUsuario | null): usuario is PerfilDoUsuario {
  return usuario !== null && usuario.status === 'Ativo';
}

function temPerfil(usuario: PerfilDoUsuario | null, perfis: readonly PerfilNome[]): boolean {
  return isAprovado(usuario) && perfis.includes(usuario.perfil);
}

export function isAdmin(usuario: PerfilDoUsuario | null): boolean {
  return temPerfil(usuario, ['Admin']);
}

export function canSeeFinanceiro(usuario: PerfilDoUsuario | null): boolean {
  return temPerfil(usuario, ['Admin', 'Financeiro']);
}

// Gestão de frota (veículos, rotas, viagens de todos). A rotina de campo do Motorista é da US17.
export function canSeeFrota(usuario: PerfilDoUsuario | null): boolean {
  return temPerfil(usuario, ['Admin', 'Gestor de Frota']);
}
