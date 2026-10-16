import { EmptyState, Screen } from '@/ui';

// Placeholder criado pela EIX-77 para a rota já existir. A EIX-39 substitui esta tela pelo formulário
// que chama a RPC `registrar_manutencao`.
export function ManutencaoFormView() {
  return (
    <Screen underHeader align="center">
      <EmptyState
        icon="manutencoes"
        title="Registro de manutenção"
        description="Veículo, serviço, valor e forma de pagamento. A despesa entra no caixa junto."
      />
    </Screen>
  );
}
