import { useLocalSearchParams } from 'expo-router';

import { VeiculoFormView } from '@/features/veiculos/VeiculoFormView';

export default function EditarVeiculoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <VeiculoFormView veiculoId={id} />;
}
