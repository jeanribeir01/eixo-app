import { EmptyState, Screen } from '@/ui';

type RotaFormViewProps = {
  // Sem id é cadastro (`/rotas/nova`); com id é edição (`/rotas/[id]/editar`), como em CategoriaFormView.
  rotaId?: string;
};

// Placeholder criado pela EIX-77 para as rotas já existirem. A EIX-38 substitui esta tela pelo formulário.
export function RotaFormView(_props: RotaFormViewProps) {
  return (
    <Screen underHeader align="center">
      <EmptyState
        icon="rotas"
        title="Origem, destino e distância"
        description="Cidade e UF de origem e de destino, com a distância estimada em km."
      />
    </Screen>
  );
}
