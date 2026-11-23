import type { PerfilDoUsuario, PerfilNome } from '@/features/auth/permissions';

import { abaInicial, abas, type AbaId } from '../menu';

// menu.ts importa o profileStore, que importa o cliente; o teste não toca a rede.
jest.mock('@/supabase/client', () => ({ supabase: {} }));

function usuario(perfil: PerfilNome, status: PerfilDoUsuario['status'] = 'Ativo'): PerfilDoUsuario {
  return { perfil, status };
}

function abasVisiveis(u: PerfilDoUsuario | null): AbaId[] {
  return abas.filter((aba) => aba.pode(u)).map((aba) => aba.id);
}

describe('menu por perfil (US17)', () => {
  it('Admin vê Início, Caixa, Frota, Relatórios e Conta; Viagens fica dentro da Frota', () => {
    expect(abasVisiveis(usuario('Admin'))).toEqual(['inicio', 'financeiro', 'frota', 'dashboards', 'configuracoes']);
  });

  it('Gestor de Frota vê Início, Frota, Viagens e Relatórios, sem Caixa', () => {
    expect(abasVisiveis(usuario('Gestor de Frota'))).toEqual(['inicio', 'frota', 'viagens', 'dashboards', 'configuracoes']);
  });

  it('Financeiro vê Início, Caixa e Relatórios, sem Frota', () => {
    expect(abasVisiveis(usuario('Financeiro'))).toEqual(['inicio', 'financeiro', 'dashboards', 'configuracoes']);
  });

  it('nenhum perfil passa de 5 abas (protótipo DESIGN-CYAN 2.0)', () => {
    for (const perfil of ['Admin', 'Gestor de Frota', 'Financeiro', 'Motorista'] as const) {
      expect(abasVisiveis(usuario(perfil)).length).toBeLessThanOrEqual(5);
    }
  });

  it('as abas têm os rótulos curtos do protótipo', () => {
    expect(abas.map((aba) => aba.rotulo)).toEqual(['Início', 'Caixa', 'Frota', 'Viagens', 'Relatórios', 'Conta']);
  });

  it('Motorista não tem Financeiro nem Dashboards', () => {
    expect(abasVisiveis(usuario('Motorista'))).toEqual(['viagens', 'configuracoes']);
  });

  it.each(['AguardandoAprovacao', 'Bloqueado'] as const)('status %s não libera nenhuma aba', (status) => {
    expect(abasVisiveis(usuario('Admin', status))).toEqual([]);
    expect(abasVisiveis(null)).toEqual([]);
  });

  it.each([
    ['Admin', 'inicio'],
    ['Gestor de Frota', 'inicio'],
    ['Financeiro', 'inicio'],
    ['Motorista', 'viagens'],
  ] as const)('%s abre o app em %s (FIN-01)', (perfil, esperada) => {
    expect(abaInicial(usuario(perfil))).toBe(esperada);
  });

  it.each([
    ['inicio', 'inicio'],
    ['dashboards', 'dashboards'],
    ['financeiro', 'financeiro'],
    ['frota', 'frota'],
    ['viagens', 'viagens'],
    ['configuracoes', 'conta'],
  ] as const)('aba %s usa o ícone %s do mapa (NAV-01)', (id, icone) => {
    expect(abas.find((aba) => aba.id === id)?.icone).toBe(icone);
  });

  it('a aba inicial de cada perfil está entre as abas que ele pode ver', () => {
    for (const perfil of ['Admin', 'Gestor de Frota', 'Financeiro', 'Motorista'] as const) {
      expect(abasVisiveis(usuario(perfil))).toContain(abaInicial(usuario(perfil)));
    }
  });
});
