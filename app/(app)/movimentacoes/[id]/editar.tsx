import { useLocalSearchParams } from 'expo-router';

import { MovimentacaoFormView } from '@/features/movimentacoes/MovimentacaoFormView';

export default function EditarMovimentacaoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <MovimentacaoFormView movimentacaoId={id} />;
}
