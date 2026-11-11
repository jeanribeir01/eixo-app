import { useLocalSearchParams } from 'expo-router';

import { MovimentacaoFormView } from '@/features/movimentacoes/MovimentacaoFormView';

export default function NovaMovimentacaoRoute() {
  // `viagemId` chega quando o lançamento é criado a partir do detalhe da viagem (US09).
  const { viagemId } = useLocalSearchParams<{ viagemId?: string }>();
  return <MovimentacaoFormView viagemIdInicial={viagemId} />;
}
