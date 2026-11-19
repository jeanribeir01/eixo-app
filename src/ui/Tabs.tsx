import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

export type TabOption = { label: string; value: string };

export type TabsProps = {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel?: string;
  /**
   * Para filtros com muitas opções (ex.: 5 status de veículo), que não cabem em 360 de largura.
   * Se as abas cabem, continuam dividindo a largura em partes iguais; se não cabem, cada uma fica
   * do tamanho do rótulo e a fileira rola na horizontal, sem cortar texto (EIX-82).
   */
  scrollable?: boolean;
};

// Tab Pill Group do DESIGN_CYAN §7 — usado nas abas Entrada/Saída de Categorias e nos filtros.
export function Tabs({ options, value, onChange, accessibilityLabel, scrollable = false }: TabsProps) {
  // Largura visível da fileira. Só a variante rolável usa: é dela que sai a parte igual de cada aba.
  const [larguraVisivel, setLarguraVisivel] = useState(0);

  // Dentro de um ScrollView o `flex: 1` deixa de dividir a largura (o conteúdo não tem largura fixa).
  // Por isso cada aba recebe como largura mínima a sua parte igual da área visível: se o rótulo cabe
  // nessa parte, todas ficam iguais e ocupam a fileira inteira; se não cabe, a aba cresce até o
  // tamanho do rótulo e a fileira passa a rolar.
  // Arredonda para baixo para a soma nunca passar da largura visível por fração de pixel (o que
  // faria a fileira rolar à toa); a sobra de menos de 1px por aba é absorvida pelo flexGrow.
  const parteIgual =
    larguraVisivel > 0 ? Math.floor((larguraVisivel - spacing.sm * (options.length - 1)) / options.length) : 0;

  const abas = options.map((option) => {
    const active = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="tab"
        accessibilityLabel={option.label}
        accessibilityState={{ selected: active }}
        onPress={() => onChange(option.value)}
        style={({ pressed }) => [
          styles.tab,
          scrollable ? [styles.tabRolavel, { minWidth: parteIgual }] : styles.tabFixa,
          active ? styles.active : styles.inactive,
          pressed && styles.pressed,
        ]}
      >
        <Text weight={active ? 'medium' : 'regular'} tone={active ? 'onAccent' : 'primary'}>
          {option.label}
        </Text>
      </Pressable>
    );
  });

  if (!scrollable) {
    return (
      <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.row}>
        {abas}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      // "handled": com o teclado aberto (ex.: busca acima do filtro), o primeiro toque já troca a aba.
      keyboardShouldPersistTaps="handled"
      onLayout={(event: LayoutChangeEvent) => setLarguraVisivel(event.nativeEvent.layout.width)}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.row, styles.rowRolavel]}>
        {abas}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  // O ScrollView horizontal cresce por padrão e empurraria o resto da tela; aqui ele só ocupa a
  // altura das abas.
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  rowRolavel: {
    flexGrow: 1,
  },
  tab: {
    minHeight: touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  tabFixa: {
    flex: 1,
  },
  // Sem encolher: a aba nunca fica menor que o rótulo, então o texto não é cortado.
  tabRolavel: {
    flexGrow: 1,
    flexShrink: 0,
  },
  // Aba ativa usa a superfície invertida (uso raro do guia, reservado a este caso).
  active: {
    backgroundColor: colors.inverted,
    borderColor: colors.inverted,
  },
  inactive: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
