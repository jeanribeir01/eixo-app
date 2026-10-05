import type { Tables } from '@/types/database';

export type FormaPagamento = Pick<Tables<'forma_pagamento'>, 'id' | 'nome' | 'ativa'>;

// As 4 formas criadas pelo seed da EIX-27 (supabase/migrations/20260924000200_catalogos.sql).
// A tabela não tem coluna que marque "fixa", então o nome é o identificador — por isso as
// fixas não podem ser renomeadas pela tela. Mantenha esta lista igual ao seed.
const FORMAS_FIXAS = ['Boleto', 'Pix', 'TED', 'Cartão Corporativo'];

export function isFormaFixa(nome: string): boolean {
  return FORMAS_FIXAS.includes(nome);
}
