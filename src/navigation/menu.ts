import type { Href } from 'expo-router';

import { canSeeFinanceiro, canSeeFrota, isAdmin, isAprovado, type PerfilDoUsuario, type PerfilNome } from '@/features/auth/permissions';
import { useProfile } from '@/features/auth/profileStore';
import type { IconName } from '@/ui';

// Único lugar que decide o menu de cada perfil (US17). Os layouts de rota leem daqui; nenhuma
// tela compara nome de perfil. Lembrete (CLAUDE.md §7): o cliente esconde, o RLS decide.

export type AbaId = 'dashboards' | 'financeiro' | 'frota' | 'viagens' | 'configuracoes';

export type Aba = {
  id: AbaId;
  rotulo: string;
  // Ícone da tab bar, pelo nome semântico do mapa de src/ui/icons.ts.
  icone: IconName;
  pode: (usuario: PerfilDoUsuario | null) => boolean;
};

function temPerfil(perfis: readonly PerfilNome[]) {
  return (usuario: PerfilDoUsuario | null) => isAprovado(usuario) && perfis.includes(usuario.perfil);
}

// A ordem aqui é a ordem da tab bar. Financeiro e Frota reaproveitam as regras da US16 para
// a navegação nunca divergir do que `useProfile()` já diz.
export const abas: readonly Aba[] = [
  // Gestor vê Dashboards pelos relatórios logísticos; o conteúdo por perfil vem nas US11–13.
  { id: 'dashboards', rotulo: 'Dashboards', icone: 'dashboards', pode: temPerfil(['Admin', 'Gestor de Frota', 'Financeiro']) },
  { id: 'financeiro', rotulo: 'Financeiro', icone: 'financeiro', pode: canSeeFinanceiro },
  { id: 'frota', rotulo: 'Frota', icone: 'frota', pode: canSeeFrota },
  { id: 'viagens', rotulo: 'Viagens', icone: 'viagens', pode: temPerfil(['Admin', 'Gestor de Frota', 'Motorista']) },
  // Todos os perfis precisam de "Sair"; o que é só do Admin (Usuários) é protegido à parte.
  { id: 'configuracoes', rotulo: 'Configurações', icone: 'configuracoes', pode: isAprovado },
];

// Onde cada perfil abre o app. Admin e Financeiro abrem no hub Financeiro, com o saldo em destaque
// (EIX-62); o Gestor de Frota, na frota; o Motorista cai direto na rotina de campo.
const abaInicialPorPerfil: Record<PerfilNome, AbaId> = {
  Admin: 'financeiro',
  'Gestor de Frota': 'frota',
  Financeiro: 'financeiro',
  Motorista: 'viagens',
};

export function abaInicial(usuario: PerfilDoUsuario | null): AbaId {
  // Sem perfil aprovado o layout raiz nem deixa entrar no app; Configurações é o fallback seguro
  // porque é a única aba que não expõe dado de módulo.
  return isAprovado(usuario) ? abaInicialPorPerfil[usuario.perfil] : 'configuracoes';
}

export function hrefDaAba(id: AbaId): Href {
  return `/${id}`;
}

// Monta o menu do usuário logado a partir do `useProfile()` da US16.
export function useMenu() {
  const { usuario } = useProfile();

  return {
    // Cada aba diz se existe para este perfil; o layout registra só as permitidas.
    abas: abas.map((aba) => ({ ...aba, visivel: aba.pode(usuario) })),
    abaInicial: abaInicial(usuario),
    // Telas internas (abertas por cima das abas) seguem o módulo a que pertencem.
    podeVerCategorias: canSeeFinanceiro(usuario),
    // Cadastro/edição de veículo: os mesmos perfis que o RLS de `veiculo` deixa escrever.
    podeVerFrota: canSeeFrota(usuario),
    podeVerUsuarios: isAdmin(usuario),
  };
}
