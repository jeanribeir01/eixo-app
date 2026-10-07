import { useLocalSearchParams } from 'expo-router';

import { DividaDetalheView } from '@/features/dividas/components/DividaDetalheView';

export default function DividaDetalheRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <DividaDetalheView id={id} />;
}
