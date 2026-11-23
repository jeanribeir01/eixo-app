import type { Href } from 'expo-router';

import { canSeeFinanceiro, canSeeFrota, isAdmin, isAprovado, type PerfilDoUsuario, type PerfilNome } from '@/features/auth/permissions';
import { useProfile } from '@/features/auth/profileStore';
import type { IconName } from '@/ui';

// Único lugar que decide o menu de cada perfil (US17). Os layouts de rota leem daqui; nenhuma
// tela compara nome de perfil. Lembrete (CLAUDE.md §7): o cliente esconde, o RLS decide.

export type AbaId = 'inicio' | 'financeiro' | 'frota' | 'viagens' | 'dashboards' | 'configuracoes';

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

// Regra das telas de viagem (abrir, fechar, lista): o Motorista entra aqui; as viagens que ele vê
// são só as dele, pelo RLS. O Admin também, mas sem a aba (ver `abas`).
const podeVerViagens = temPerfil(['Admin', 'Gestor de Frota', 'Motorista']);

// A ordem aqui é a ordem da tab bar (protótipo DESIGN-CYAN 2.0): Início · Caixa · Frota · Viagens ·
// Relatórios · Conta, e nenhum perfil passa de 5 abas. Financeiro e Frota reaproveitam as regras da
// US16 para a navegação nunca divergir do que `useProfile()` já diz.
export const abas: readonly Aba[] = [
  // O que pede atenção hoje, por perfil. O Motorista não tem: a rotina dele já é a aba Viagens.
  { id: 'inicio', rotulo: 'Início', icone: 'inicio', pode: temPerfil(['Admin', 'Gestor de Frota', 'Financeiro']) },
  // A rota continua `/financeiro`; o rótulo curto "Caixa" é o que cabe na barra.
  { id: 'financeiro', rotulo: 'Caixa', icone: 'financeiro', pode: canSeeFinanceiro },
  { id: 'frota', rotulo: 'Frota', icone: 'frota', pode: canSeeFrota },
  // Sem o Admin: com Início, Caixa e Frota ele passaria de 5 abas. Ele abre as viagens pelo hub Frota
  // (`/frota/viagens`), com a mesma tela.
  { id: 'viagens', rotulo: 'Viagens', icone: 'viagens', pode: temPerfil(['Gestor de Frota', 'Motorista']) },
  // Gestor vê Relatórios pelo ranking logístico; o conteúdo por perfil vem nas US11–13.
  { id: 'dashboards', rotulo: 'Relatórios', icone: 'dashboards', pode: temPerfil(['Admin', 'Gestor de Frota', 'Financeiro']) },
  // Todos os perfis precisam de "Sair"; o que é só do Admin (Usuários) é protegido à parte.
  { id: 'configuracoes', rotulo: 'Conta', icone: 'conta', pode: isAprovado },
];

// Onde cada perfil abre o app: no Início, que mostra o que pede atenção no módulo dele. O Motorista cai
// direto na rotina de campo.
const abaInicialPorPerfil: Record<PerfilNome, AbaId> = {
  Admin: 'inicio',
  'Gestor de Frota': 'inicio',
  Financeiro: 'inicio',
  Motorista: 'viagens',
};

export function abaInicial(usuario: PerfilDoUsuario | null): AbaId {
  // Sem perfil aprovado o layout raiz nem deixa entrar no app; Conta é o fallback seguro
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
    // Veículos, rotas e manutenções: os mesmos perfis que o RLS de `veiculo` e `rota` e a RPC
    // `registrar_manutencao` deixam escrever.
    podeVerFrota: canSeeFrota(usuario),
    podeVerViagens: podeVerViagens(usuario),
    // Quem vê viagens mas não tem a aba (Admin) abre a lista pelo hub Frota.
    viagensForaDaAba: podeVerViagens(usuario) && !abas.some((aba) => aba.id === 'viagens' && aba.pode(usuario)),
    podeVerUsuarios: isAdmin(usuario),
  };
}
