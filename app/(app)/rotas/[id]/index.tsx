import { useLocalSearchParams } from 'expo-router';

import { RotaDetalheView } from '@/features/rotas/RotaDetalheView';

export default function RotaDetalheRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RotaDetalheView id={id} />;
}
