import { useLocalSearchParams } from 'expo-router';

import { ViagemLancamentosView } from '@/features/ponte-viagem/ViagemLancamentosView';

// Lançamentos vinculados a uma viagem (US09). Só Admin e Financeiro: o guard está em
// app/(app)/_layout.tsx. O Financeiro chega aqui por "Lançamentos por viagem"; o Admin, também pelo
// Detalhe da viagem.
export default function ViagemLancamentosRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ViagemLancamentosView viagemId={id} />;
}
