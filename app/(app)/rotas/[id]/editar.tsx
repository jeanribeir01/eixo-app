import { useLocalSearchParams } from 'expo-router';

import { RotaFormView } from '@/features/rotas/RotaFormView';

export default function EditarRotaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <RotaFormView rotaId={id} />;
}
