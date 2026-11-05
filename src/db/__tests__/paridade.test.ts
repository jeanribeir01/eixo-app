import { getTableColumns } from 'drizzle-orm';

import type { Database } from '@/types/database';

import { rota, veiculo, viagem } from '../schema';

// Tipos do TypeScript não existem em runtime, então a lista de colunas do Postgres é escrita aqui
// como `Record<keyof Row, true>`: o compilador EXIGE todas as chaves do Row gerado. Se o
// `supabase gen types` trouxer uma coluna nova (ou tirar uma), o `npm run typecheck` quebra neste
// arquivo e o time lembra de atualizar o schema Drizzle e a migration local (ADR 0004).
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

const colunasVeiculo: Record<keyof Row<'veiculo'>, true> = {
  id: true,
  placa: true,
  marca: true,
  modelo: true,
  capacidade_carga: true,
  status: true,
  ano_fabricacao: true,
  data_inclusao: true,
  data_atualizacao: true,
};

const colunasRota: Record<keyof Row<'rota'>, true> = {
  id: true,
  cidade_origem: true,
  cidade_destino: true,
  uf_origem: true,
  uf_destino: true,
  distancia_estimada_km: true,
  ativa: true,
  data_inclusao: true,
  data_atualizacao: true,
};

const colunasViagem: Record<keyof Row<'viagem'>, true> = {
  id: true,
  veiculo_id: true,
  rota_id: true,
  motorista_id: true,
  hodometro_inicial: true,
  hodometro_final: true,
  data_inicio: true,
  data_fim: true,
  status: true,
  km_rodado: true,
  data_inclusao: true,
  data_atualizacao: true,
};

// `getTableColumns` devolve as colunas pela chave do objeto, que no schema é igual ao nome no banco.
// `em_revisao` é local (o Postgres não tem essa coluna): fica fora da comparação de paridade.
const nomes = (colunas: object) =>
  Object.keys(colunas)
    .filter((nome) => nome !== 'em_revisao')
    .sort();

describe('paridade Postgres x Drizzle', () => {
  it.each([
    ['veiculo', veiculo, colunasVeiculo],
    ['rota', rota, colunasRota],
    ['viagem', viagem, colunasViagem],
  ] as const)('%s tem as mesmas colunas do Row gerado', (_nome, tabela, esperado) => {
    expect(nomes(getTableColumns(tabela))).toEqual(nomes(esperado));
  });
});
