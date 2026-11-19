import { Children, useContext, type ReactNode } from 'react';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { FAB_ALTURA_RESERVADA } from './FAB';
import { colors, layout, spacing } from './tokens';
import { useTablet } from './useTablet';

type ScreenProps = {
  children: ReactNode;
  // "center" para telas curtas (Login); "top" para conteúdo que cresce para baixo.
  align?: 'top' | 'center';
  // Tela interna aberta por cima das abas, com header nativo: o header já protege o topo.
  underHeader?: boolean;
  // Conteúdo que pode passar da altura da tela (formulário, detalhe): rola e sobe com o teclado.
  scroll?: boolean;
  // Tela de lista: quem rola é uma FlatList filha, não o Screen. No tablet a FlatList ocupa a largura
  // toda (arrastar e puxar para atualizar funcionam até a borda) e o conteúdo fica na coluna de 720:
  // os campos acima da lista vão num <ScreenColumn> e a lista usa useScreenColumn() no
  // contentContainerStyle. No celular nada muda. Não combine com `scroll`.
  list?: boolean;
  // O que flutua sobre o conteúdo e não rola com ele, como o Snackbar.
  overlay?: ReactNode;
  // Botão flutuante da ação principal. Fica no rodapé à direita, sempre abaixo do overlay.
  fab?: ReactNode;
};

const TODAS_AS_BORDAS: Edge[] = ['top', 'right', 'bottom', 'left'];
const SEM_O_TOPO: Edge[] = ['right', 'bottom', 'left'];

// Fundo ocupa a janela; o conteúdo mantém uma largura legível no tablet (RNF02).
export function Screen({
  children,
  align = 'top',
  underHeader = false,
  scroll = false,
  list = false,
  overlay,
  fab,
}: ScreenProps) {
  // O KeyboardAvoidingView calcula a sobreposição do teclado a partir da posição dele dentro da tela.
  // Sob um header nativo essa posição começa abaixo do header, então a altura dele entra como desconto;
  // sem isso o campo focado fica escondido atrás do teclado. Fora de um navegador o contexto vem vazio.
  const alturaDoHeader = useContext(HeaderHeightContext) ?? 0;
  const tablet = useTablet();
  // Lista no tablet: a View deixa de limitar a largura e de dar o respiro lateral; quem limita é a
  // coluna (ScreenColumn e useScreenColumn). Objetos de estilo inteiros trocados, nunca chave com
  // `undefined`, pelo mesmo motivo do tabletOverlay: celular → tablet com a tela aberta.
  const conteudoSemScroll =
    list && tablet
      ? [styles.flex, styles.contentLista]
      : [styles.flex, styles.content, tablet && styles.tablet, align === 'center' && styles.center];

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
            contentContainerStyle={[styles.content, tablet && styles.tablet, align === 'center' && styles.centerScroll, !!fab && styles.espacoDoFab]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View testID="screen-conteudo" style={conteudoSemScroll}>
          {children}
        </View>
      )}
      {(overlay || fab) && (
        // Snackbar antes do FAB: empilhados no rodapé, a mensagem aparece sempre acima do botão.
        // O posicionamento é um OU outro (nunca "absoluteFill + anular left/right"): ver tabletOverlay.
        <View
          testID="screen-camada-flutuante"
          style={[tablet ? styles.tabletOverlay : StyleSheet.absoluteFill, styles.overlay]}
          pointerEvents="box-none"
        >
          {overlay}
          {fab}
        </View>
      )}
    </SafeAreaView>
  );
}

// Estilo da coluna de conteúdo de uma <Screen list> (EIX-94). Vai no contentContainerStyle da
// FlatList, para as linhas e o estado vazio ficarem na coluna enquanto a rolagem usa a largura toda.
// No celular não acrescenta nada: o respiro lateral continua vindo do próprio Screen.
export function useScreenColumn(): StyleProp<ViewStyle> {
  return useTablet() ? styles.coluna : null;
}

// O que fica fora da lista numa <Screen list> (busca, filtros, título, carregando, erro): no tablet
// fica na mesma coluna das linhas, alinhado com elas. Mesmo gap do Screen entre os filhos.
export function ScreenColumn({ children }: { children: ReactNode }) {
  const coluna = useScreenColumn();
  // Sem filhos (ex.: só a lista na tela), nada de View vazia somando mais um gap acima da lista.
  if (Children.toArray(children).length === 0) return null;
  return (
    <View testID="screen-coluna" style={[styles.grupo, coluna]}>
      {children}
    </View>
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
  tablet: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  // <Screen list> no tablet: largura toda e sem respiro lateral, que passa para a coluna.
  contentLista: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  // Mesma largura e mesmo respiro lateral do conteúdo das outras telas no tablet.
  coluna: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
  },
  grupo: {
    gap: spacing.lg,
  },
  // Camada flutuante no tablet: substitui o absoluteFill em vez de anular left/right com undefined.
  // Com left/right definidos o Yoga ignora o alignSelf e a camada não centraliza; e o renderer nativo
  // não aplica `undefined` quando a View já está montada (celular → tablet com a tela aberta, ao girar
  // ou dividir a tela), então left: 0 ficaria valendo. Trocando o objeto inteiro, o diff remove as chaves.
  tabletOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  center: {
    justifyContent: 'center',
  },
  // Camada que flutua sobre a tela: o Snackbar assenta no rodapé, com o respiro lateral da tela.
  overlay: {
    justifyContent: 'flex-end',
    padding: spacing.base,
    gap: spacing.md,
  },
  // No fim da rolagem, espaço para o FAB não cobrir a última linha.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
  // No ScrollView o centro só funciona se o conteúdo puder crescer até a altura da tela.
  centerScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
