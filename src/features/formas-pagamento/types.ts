import type { Tables } from '@/types/database';

export type FormaPagamento = Pick<Tables<'forma_pagamento'>, 'id' | 'nome' | 'ativa'>;
