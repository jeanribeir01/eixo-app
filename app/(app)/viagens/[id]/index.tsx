import { useLocalSearchParams } from 'expo-router';

import { ViagemLancamentosView } from '@/features/ponte-viagem/ViagemLancamentosView';

// Detalhe da viagem com os lançamentos vinculados (US09). Só Admin e Financeiro: o guard está em
// app/(app)/_layout.tsx.
export default function ViagemDetalheRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ViagemLancamentosView viagemId={id} />;
}
