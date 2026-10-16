import { EmptyState, Screen } from '@/ui';

type FecharViagemViewProps = {
  // Id da viagem em andamento, vindo de `/viagens/[id]/fechar`.
  viagemId: string;
};

// Placeholder criado pela EIX-77 para a rota já existir. A EIX-40 substitui esta tela pelo formulário
// de fechamento.
export function FecharViagemView(_props: FecharViagemViewProps) {
  return (
    <Screen underHeader align="center">
      <EmptyState
        icon="viagens"
        title="Hodômetro final"
        description="O hodômetro final encerra a viagem e calcula os km rodados."
      />
    </Screen>
  );
}
