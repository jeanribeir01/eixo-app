import { EmptyState, Screen } from '@/ui';

// Placeholder criado pela EIX-77: é a aba Viagens. A EIX-40 substitui esta tela pela lista real.
// Aba não tem header nativo, então o título "Viagens" fica no conteúdo.
export function ViagensListView() {
  return (
    <Screen align="center">
      <EmptyState
        icon="viagens"
        title="Viagens"
        description="Abertura e fechamento de viagens com o hodômetro, mesmo sem internet."
      />
    </Screen>
  );
}
