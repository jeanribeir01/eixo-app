import { Children, createContext, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

// Avisa a linha que ela está dentro de um grupo: aí quem desenha a separação é o grupo, e a linha
// ganha o respiro lateral que a tela daria.
export const ListSectionContext = createContext(false);

type ListSectionProps = {
  label?: string;
  children: ReactNode;
};

// Grupo de linhas (menu do Financeiro, tela de Conta): um bloco surface com borda hairline e
// separadores só entre as linhas. Agrupa por borda e fundo, sem virar "um cartão por linha".
export function ListSection({ label, children }: ListSectionProps) {
  // toArray descarta null e false: uma linha condicional que não aparece não deixa separador sobrando.
  const linhas = Children.toArray(children);

  return (
    <View style={styles.wrapper}>
      {!!label && (
        <Text variant="caption" tone="body" weight="medium">
          {label}
        </Text>
      )}
      <View testID="bloco-secao" style={styles.bloco}>
        <ListSectionContext.Provider value={true}>
          {linhas.map((linha, indice) => (
            <Fragment key={indice}>
              {indice > 0 && <View testID="separador-secao" style={styles.separador} />}
              {linha}
            </Fragment>
          ))}
        </ListSectionContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  bloco: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    // Corta o ripple das linhas nos cantos arredondados.
    overflow: 'hidden',
  },
  separador: {
    height: 1,
    backgroundColor: colors.border,
  },
});
