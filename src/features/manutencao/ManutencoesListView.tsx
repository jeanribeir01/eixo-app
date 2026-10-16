import { EmptyState, Screen } from '@/ui';

// Placeholder criado pela EIX-77 para a rota já existir. A EIX-39 substitui esta tela pela lista real.
// O título "Manutenções" já está no header nativo, por isso o estado vazio fala do conteúdo.
export function ManutencoesListView() {
  return (
    <Screen underHeader align="center">
      <EmptyState
        icon="manutencoes"
        title="Ordens de serviço"
        description="Histórico de manutenções da frota, com a despesa lançada no caixa."
      />
    </Screen>
  );
}
