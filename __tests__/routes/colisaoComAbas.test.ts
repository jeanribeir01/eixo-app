import { readdirSync } from 'fs';
import { join, relative } from 'path';

import { abas, hrefDaAba } from '@/navigation/menu';

// NAV5-12 (EIX-77): uma rota interna com a mesma URL de uma aba "rouba" a aba. Testado em 16/10/2026:
// com `app/(app)/frota/index.tsx`, a URL `/frota` abre a lista e o hub de Frota (home do Gestor) some.
// Por isso a lista de veículos mora em `frota/veiculos` e a de viagens é a própria aba.
const PASTA_APP = join(__dirname, '../../app/(app)');

function arquivosDeRota(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return item.name === '(tabs)' ? [] : arquivosDeRota(caminho);
    return item.name.endsWith('.tsx') && !item.name.startsWith('_') ? [caminho] : [];
  });
}

// `rotas/index.tsx` → `/rotas`; `(grupo)/x.tsx` → `/x`. Mesma regra de URL do expo-router.
function urlDoArquivo(arquivo: string): string {
  const partes = relative(PASTA_APP, arquivo)
    .replace(/\.tsx$/, '')
    .split(/[\\/]/)
    .filter((parte) => !/^\(.*\)$/.test(parte));
  if (partes[partes.length - 1] === 'index') partes.pop();
  return `/${partes.join('/')}`;
}

describe('rotas internas não colidem com as abas (NAV5-12)', () => {
  const urlsInternas = arquivosDeRota(PASTA_APP).map(urlDoArquivo);

  it('encontra as rotas internas da pasta app/(app)', () => {
    expect(urlsInternas).toEqual(expect.arrayContaining(['/frota/veiculos', '/rotas', '/manutencoes', '/viagens/nova']));
  });

  it.each(abas.map((aba) => hrefDaAba(aba.id) as string))('nenhuma rota interna usa a URL da aba %s', (urlDaAba) => {
    expect(urlsInternas).not.toContain(urlDaAba);
  });
});
