import { Text } from './Text';

export type TituloSecaoProps = {
  titulo: string;
  // Quantos itens a seção tem: vira "Concluídas · 93".
  quantidade?: number;
};

// Título de seção (DESIGN-CYAN 2.0 §2): `title` 17 em peso 600, o único estilo de título dentro de uma
// tela. O outro é o título da própria tela (`heading`). Grupo de lista, bloco do Início, seção de
// detalhe e de formulário usam este; ninguém monta título de seção com Text solto.
// accessibilityRole="header" deixa o leitor de tela pular de seção em seção.
export function TituloSecao({ titulo, quantidade }: TituloSecaoProps) {
  return (
    <Text variant="title" weight="semibold" accessibilityRole="header">
      {quantidade === undefined ? titulo : `${titulo} · ${quantidade}`}
    </Text>
  );
}
