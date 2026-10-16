import { EmptyState, Screen } from '@/ui';

// Placeholder criado pela EIX-77 para a rota `/viagens/nova` já existir. A EIX-40 substitui esta tela
// pelo formulário de abertura.
export function AbrirViagemView() {
  return (
    <Screen underHeader align="center">
      <EmptyState icon="viagens" title="Hodômetro inicial" description="Veículo, rota, motorista e hodômetro inicial da viagem." />
    </Screen>
  );
}
