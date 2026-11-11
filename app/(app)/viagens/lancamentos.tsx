import { ViagensLancamentosListView } from '@/features/ponte-viagem/ViagensLancamentosListView';

// Lista de viagens para ver os lançamentos de cada uma (US09). Só Admin e Financeiro: o guard está
// em app/(app)/_layout.tsx.
export default function ViagensLancamentosRoute() {
  return <ViagensLancamentosListView />;
}
