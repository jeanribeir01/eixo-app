import { useLocalSearchParams } from 'expo-router';

import { FecharViagemView } from '@/features/viagens/FecharViagemView';

export default function FecharViagemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <FecharViagemView viagemId={id} />;
}
