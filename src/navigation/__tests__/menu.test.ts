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
  it('Admin vê o menu completo', () => {
    expect(abasVisiveis(usuario('Admin'))).toEqual(['dashboards', 'financeiro', 'frota', 'viagens', 'configuracoes']);
  });

  it('Gestor de Frota vê Frota, Viagens e Dashboards, sem Financeiro', () => {
    expect(abasVisiveis(usuario('Gestor de Frota'))).toEqual(['dashboards', 'frota', 'viagens', 'configuracoes']);
  });

  it('Financeiro vê Financeiro e Dashboards, sem Frota', () => {
    expect(abasVisiveis(usuario('Financeiro'))).toEqual(['dashboards', 'financeiro', 'configuracoes']);
  });

  it('Motorista não tem Financeiro nem Dashboards', () => {
    expect(abasVisiveis(usuario('Motorista'))).toEqual(['viagens', 'configuracoes']);
  });

  it.each(['AguardandoAprovacao', 'Bloqueado'] as const)('status %s não libera nenhuma aba', (status) => {
    expect(abasVisiveis(usuario('Admin', status))).toEqual([]);
    expect(abasVisiveis(null)).toEqual([]);
  });

  it.each([
    ['Admin', 'dashboards'],
    ['Gestor de Frota', 'frota'],
    ['Financeiro', 'dashboards'],
    ['Motorista', 'viagens'],
  ] as const)('%s abre o app em %s', (perfil, esperada) => {
    expect(abaInicial(usuario(perfil))).toBe(esperada);
  });

  it.each([
    ['dashboards', 'dashboards'],
    ['financeiro', 'financeiro'],
    ['frota', 'frota'],
    ['viagens', 'viagens'],
    ['configuracoes', 'configuracoes'],
  ] as const)('aba %s usa o ícone %s do mapa (NAV-01)', (id, icone) => {
    expect(abas.find((aba) => aba.id === id)?.icone).toBe(icone);
  });

  it('a aba inicial de cada perfil está entre as abas que ele pode ver', () => {
    for (const perfil of ['Admin', 'Gestor de Frota', 'Financeiro', 'Motorista'] as const) {
      expect(abasVisiveis(usuario(perfil))).toContain(abaInicial(usuario(perfil)));
    }
  });
});
