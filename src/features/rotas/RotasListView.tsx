import { EmptyState, Screen } from '@/ui';

// Placeholder criado pela EIX-77 para a rota já existir. A EIX-38 substitui esta tela pela lista real.
// O título "Rotas" já está no header nativo, por isso o estado vazio fala do conteúdo.
export function RotasListView() {
  return (
    <Screen underHeader align="center">
      <EmptyState
        icon="rotas"
        title="Trechos padrão"
        description="Origem, destino e distância estimada das rotas mais comuns da frota."
      />
    </Screen>
  );
}
