import { useLocalSearchParams } from 'expo-router';

import { ViagemDetalheView } from '@/features/viagens/ViagemDetalheView';

// Detalhe da viagem (US08): quem vê viagens abre qualquer uma pela lista. O guard está em
// app/(app)/_layout.tsx.
export default function ViagemDetalheRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ViagemDetalheView viagemId={id} />;
}
