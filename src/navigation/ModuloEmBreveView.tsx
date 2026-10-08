import { EmptyState, Screen, type IconName } from '@/ui';

type ModuloEmBreveViewProps = {
  titulo: string;
  icone: IconName;
  // Uma frase do que o módulo vai fazer: a aba explica o que vem, em vez de "em construção".
  descricao: string;
};

// Destino provisório das abas cujos módulos ainda não foram construídos (US17). Cada US do módulo
// troca este placeholder pela tela real, sem mexer no menu.
export function ModuloEmBreveView({ titulo, icone, descricao }: ModuloEmBreveViewProps) {
  return (
    <Screen align="center">
      <EmptyState icon={icone} title={titulo} description={descricao} />
    </Screen>
  );
}
