import { VeiculosListView } from '@/features/veiculos/VeiculosListView';

// `frota/veiculos`, e não `frota/index`: `frota/index` teria a mesma URL da aba Frota (`/frota`) e o
// expo-router abriria a lista no lugar do hub.
export default function VeiculosRoute() {
  return <VeiculosListView />;
}
