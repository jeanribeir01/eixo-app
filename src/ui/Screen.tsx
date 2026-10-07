import { useContext, type ReactNode } from 'react';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from './tokens';

type ScreenProps = {
  children: ReactNode;
  // "center" para telas curtas (Login); "top" para conteúdo que cresce para baixo.
  align?: 'top' | 'center';
  // Tela interna aberta por cima das abas, com header nativo: o header já protege o topo.
  underHeader?: boolean;
  // Conteúdo que pode passar da altura da tela (formulário, detalhe): rola e sobe com o teclado.
  scroll?: boolean;
  // O que flutua sobre o conteúdo e não rola com ele: Snackbar e FAB.
  overlay?: ReactNode;
};

const TODAS_AS_BORDAS: Edge[] = ['top', 'right', 'bottom', 'left'];
const SEM_O_TOPO: Edge[] = ['right', 'bottom', 'left'];

// Fundo canvas + padding lateral de 16: sem largura fixa, o conteúdo flui em celular e tablet (RNF02).
export function Screen({ children, align = 'top', underHeader = false, scroll = false, overlay }: ScreenProps) {
  // O KeyboardAvoidingView calcula a sobreposição do teclado a partir da posição dele dentro da tela.
  // Sob um header nativo essa posição começa abaixo do header, então a altura dele entra como desconto;
  // sem isso o campo focado fica escondido atrás do teclado. Fora de um navegador o contexto vem vazio.
  const alturaDoHeader = useContext(HeaderHeightContext) ?? 0;

  return (
    <SafeAreaView edges={underHeader ? SEM_O_TOPO : TODAS_AS_BORDAS} style={styles.screen}>
      {scroll ? (
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={underHeader ? alturaDoHeader : 0}
          style={styles.flex}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, align === 'center' && styles.centerScroll]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.flex, styles.content, align === 'center' && styles.center]}>{children}</View>
      )}
      {overlay && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="box-none">
          {overlay}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    justifyContent: 'center',
  },
  // Camada que flutua sobre a tela: o Snackbar assenta no rodapé, com o respiro lateral da tela.
  overlay: {
    justifyContent: 'flex-end',
    padding: spacing.base,
  },
  // No ScrollView o centro só funciona se o conteúdo puder crescer até a altura da tela.
  centerScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
