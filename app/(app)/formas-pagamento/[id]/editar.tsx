import { useLocalSearchParams } from 'expo-router';

import { FormaPagamentoFormView } from '@/features/formas-pagamento/FormaPagamentoFormView';

export default function EditarFormaPagamentoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <FormaPagamentoFormView formaPagamentoId={id} />;
}
