import { PaymentMethod } from './types';

export const FIXED_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'fixed-boleto', name: 'Boleto', isFixed: true },
  { id: 'fixed-pix', name: 'Pix', isFixed: true },
  { id: 'fixed-ted', name: 'Transferência TED', isFixed: true },
  { id: 'fixed-card', name: 'Cartão Corporativo', isFixed: true },
];