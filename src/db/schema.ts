import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { Constants } from '@/types/database';

// Espelho local do Postgres (ADR 0004). Os nomes de coluna são IDÊNTICOS aos do banco
// (snake_case) para o mapeamento ser 1:1. Conversão de tipos:
//   uuid / enum / timestamptz -> text (datas em ISO 8601 UTC)
//   numeric -> real | smallint -> integer | boolean -> integer({ mode: 'boolean' })
// Os valores dos enums vêm de `Constants` (gerado pelo supabase gen types), para não
// redeclarar à mão o que o banco já define.
const { perfil_nome, status_usuario, status_veiculo, status_viagem, uf } = Constants.public.Enums;

// veiculo: somente leitura no app (cache para o motorista escolher o veículo offline).
// O espelho NÃO replica as checks de normalização de placa do Postgres: a tabela só é lida aqui
// e quem grava é o servidor, que já valida. Duplicar a regra no aparelho só criaria divergência.
export const veiculo = sqliteTable(
  'veiculo',
  {
    id: text('id').primaryKey(),
    placa: text('placa').notNull(),
    marca: text('marca').notNull(),
    modelo: text('modelo').notNull(),
    capacidade_carga: real('capacidade_carga').notNull(),
    status: text('status', { enum: status_veiculo }).notNull().default('Disponivel'),
    ano_fabricacao: integer('ano_fabricacao'),
    data_inclusao: text('data_inclusao').notNull(),
    data_atualizacao: text('data_atualizacao').notNull(),
  },
  (t) => [
    // Espelha `veiculo_placa_unique` do Postgres.
    uniqueIndex('veiculo_placa_unique').on(t.placa),
  ],
);

// rota: somente leitura no app (cache para escolher a rota offline).
// O espelho NÃO replica `rota_trecho_unico` nem as checks de normalização de cidade: a tabela só é
// lida aqui e o servidor valida a escrita.
export const rota = sqliteTable('rota', {
  id: text('id').primaryKey(),
  cidade_origem: text('cidade_origem').notNull(),
  cidade_destino: text('cidade_destino').notNull(),
  uf_origem: text('uf_origem', { enum: uf }).notNull(),
  uf_destino: text('uf_destino', { enum: uf }).notNull(),
  distancia_estimada_km: real('distancia_estimada_km').notNull(),
  ativa: integer('ativa', { mode: 'boolean' }).notNull().default(true),
  data_inclusao: text('data_inclusao').notNull(),
  data_atualizacao: text('data_atualizacao').notNull(),
});

// usuario_cache: apenas o necessário para mostrar nomes de motorista e permitir que Admin/Gestor
// escolha o motorista offline. O RLS continua sendo a barreira: Motorista baixa só a própria linha.
export const usuarioCache = sqliteTable('usuario_cache', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email'),
  status: text('status', { enum: status_usuario }).notNull(),
  perfil: text('perfil', { enum: perfil_nome }).notNull(),
  data_atualizacao: text('data_atualizacao').notNull(),
});

// viagem: a única tabela que o motorista escreve offline.
export const viagem = sqliteTable(
  'viagem',
  {
    id: text('id').primaryKey(),
    veiculo_id: text('veiculo_id')
      .notNull()
      .references(() => veiculo.id),
    rota_id: text('rota_id')
      .notNull()
      .references(() => rota.id),
    // Sem FK: o cache de usuários é uma cópia parcial e pode estar vazio no primeiro login
    // offline. O servidor continua validando `viagem_motorista_id_fkey`.
    motorista_id: text('motorista_id').notNull(),
    hodometro_inicial: real('hodometro_inicial').notNull(),
    hodometro_final: real('hodometro_final'),
    data_inicio: text('data_inicio'),
    data_fim: text('data_fim'),
    status: text('status', { enum: status_viagem }).notNull().default('EmAndamento'),
    // No Postgres é coluna GERADA (hodometro_final - hodometro_inicial). Aqui é coluna
    // comum, preenchida pelo servidor na sincronização: o app nunca a escreve.
    km_rodado: real('km_rodado'),
    // Só existe no SQLite. Marca a viagem que o servidor recusou e cujo conflito foi enviado à
    // fila de revisão do gestor. O dado local original é preservado até a revisão.
    em_revisao: integer('em_revisao', { mode: 'boolean' }).notNull().default(false),
    data_inclusao: text('data_inclusao').notNull(),
    data_atualizacao: text('data_atualizacao').notNull(),
  },
  (t) => [
    // Espelha `viagem_um_andamento_por_veiculo` do Postgres: um veículo só pode ter uma
    // viagem em andamento. Barrar já no aparelho dá erro imediato, sem esperar o servidor.
    uniqueIndex('viagem_um_andamento_por_veiculo')
      .on(t.veiculo_id)
      .where(sql`${t.status} = 'EmAndamento'`),
  ],
);

// outbox: fila de operações locais ainda não enviadas ao Supabase. O `id` é um UUID gerado
// no cliente, então reenviar a mesma operação sobe como upsert e não duplica (ADR 0004).
//
// `usuario_id` separa as filas de contas diferentes que usaram o aparelho. O dreno só envia a
// fila do usuário logado, mesmo que uma limpeza de logout tenha falhado.
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  usuario_id: text('usuario_id').notNull().default(''),
  entidade: text('entidade', { enum: ['viagem'] }).notNull(),
  operacao: text('operacao', { enum: ['insert', 'update'] }).notNull(),
  // JSON serializado da linha; o SQLite não tem tipo JSON próprio.
  payload: text('payload').notNull(),
  status: text('status', { enum: ['pendente', 'revisao'] }).notNull().default('pendente'),
  tentativas: integer('tentativas').notNull().default(0),
  // ISO 8601. Nulo = pode tentar agora. Erro de conexão usa backoff sem gastar tentativa.
  proxima_tentativa_em: text('proxima_tentativa_em'),
  codigo_erro: text('codigo_erro'),
  criado_em: text('criado_em').notNull(),
  ultimo_erro: text('ultimo_erro'),
});

// Metadados do cache local. Hoje guarda o dono do cache (`cache_owner`), para uma troca de conta
// nunca mostrar dados da anterior, mesmo que o logout tenha falhado no meio.
export const syncMeta = sqliteTable('sync_meta', {
  chave: text('chave').primaryKey(),
  valor: text('valor').notNull(),
});

export type Veiculo = typeof veiculo.$inferSelect;
export type NovoVeiculo = typeof veiculo.$inferInsert;
export type Rota = typeof rota.$inferSelect;
export type NovaRota = typeof rota.$inferInsert;
export type UsuarioCache = typeof usuarioCache.$inferSelect;
export type NovoUsuarioCache = typeof usuarioCache.$inferInsert;
export type Viagem = typeof viagem.$inferSelect;
export type NovaViagem = typeof viagem.$inferInsert;
export type OutboxItem = typeof outbox.$inferSelect;
export type NovoOutboxItem = typeof outbox.$inferInsert;
export type SyncMeta = typeof syncMeta.$inferSelect;
