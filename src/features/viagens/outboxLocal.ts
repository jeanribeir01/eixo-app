import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as schema from '@/db/schema';

// Leituras da outbox usadas pelo repositório, pelo pull e pelo dreno. Ficam num módulo só para as
// três camadas concordarem sobre "qual viagem tem operação local ainda não confirmada".
type Db = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export function viagemIdDoPayload(payload: string): string | null {
  try {
    const dado = JSON.parse(payload) as { id?: unknown };
    return typeof dado.id === 'string' && dado.id.length > 0 ? dado.id : null;
  } catch {
    // Payload quebrado vira revisão no dreno; aqui ele só não protege nenhuma linha local.
    return null;
  }
}

/**
 * Ids das viagens com operação na outbox (pendente ou em revisão). Sem `usuarioId`, considera a
 * outbox de todas as contas do aparelho: é o que protege a viagem offline de uma conta enquanto
 * outra está logada.
 */
export function idsDeViagensNaOutbox(database: Db, usuarioId?: string | null): Set<string> {
  const consulta = database
    .select({ payload: schema.outbox.payload })
    .from(schema.outbox);
  const itens =
    usuarioId && usuarioId.length > 0
      ? consulta.where(eq(schema.outbox.usuario_id, usuarioId)).all()
      : consulta.all();

  const ids = new Set<string>();
  for (const item of itens) {
    const id = viagemIdDoPayload(item.payload);
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Ids das viagens que pertencem à outbox de OUTRA conta. Elas ficam no SQLite até o dono voltar e
 * sincronizar, mas não podem aparecer nem ser alteradas pela conta logada.
 */
export function idsDeViagensDeOutrasContas(database: Db, usuarioId: string | null): Set<string> {
  const itens = database
    .select({ payload: schema.outbox.payload, usuario_id: schema.outbox.usuario_id })
    .from(schema.outbox)
    .all();

  const ids = new Set<string>();
  for (const item of itens) {
    if (item.usuario_id === usuarioId) continue;
    const id = viagemIdDoPayload(item.payload);
    if (id) ids.add(id);
  }
  // A mesma viagem pode ter operação das duas contas (ex.: Gestor fechou a viagem de um motorista
  // que ainda tinha a abertura na fila). Ela continua visível para quem também tem operação nela.
  if (usuarioId) {
    for (const id of idsDeViagensNaOutbox(database, usuarioId)) ids.delete(id);
  }
  return ids;
}
