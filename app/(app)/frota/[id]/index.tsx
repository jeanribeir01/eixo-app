import { useLocalSearchParams } from 'expo-router';

import { VeiculoDetalheView } from '@/features/manutencao/VeiculoDetalheView';

export default function VeiculoDetalheRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <VeiculoDetalheView veiculoId={id} />;
}
