import { useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
import { ListItem } from './ListItem';
import type { SelectOption } from './Select';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

export type ChipFiltroProps = {
  // Nome do filtro ("Tipo"). Aparece no chip enquanto o filtro está no valor padrão e é o título da
  // folha de opções.
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  // Valor que não filtra nada ("todas"). Nele o chip fica neutro e mostra o nome do filtro; fora dele,
  // fica tingido e mostra a opção escolhida. Sem valor padrão (ex.: o mês), o chip está sempre ativo.
  valorPadrao?: string;
};

// Chip de filtro com seta (referência Nubank do redesign): o chip resume o valor escolhido e as opções
// abrem numa folha inferior, a mesma do Select. Vários chips cabem numa linha só, que rola na
// horizontal (LinhaDeFiltros), no lugar de duas ou três fileiras de abas.
export function ChipFiltro({ label, value, options, onChange, valorPadrao }: ChipFiltroProps) {
  const [aberto, setAberto] = useState(false);

  const escolhida = options.find((opcao) => opcao.value === value);
  const ativo = valorPadrao === undefined || value !== valorPadrao;
  const texto = ativo ? (escolhida?.label ?? label) : label;

  function escolher(novoValor: string) {
    setAberto(false);
    onChange(novoValor);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        // "Tipo: Entradas" — o leitor de tela ouve o filtro e o valor, mesmo quando o chip mostra só um.
        accessibilityLabel={`${label}: ${escolhida?.label ?? texto}`}
        accessibilityState={{ expanded: aberto }}
        onPress={() => setAberto(true)}
        style={({ pressed }) => [styles.chip, ativo ? styles.ativo : styles.neutro, pressed && styles.pressionado]}
      >
        <Text numberOfLines={1} weight={ativo ? 'medium' : 'regular'} tone={ativo ? 'accent' : 'primary'}>
          {texto}
        </Text>
        <Icon name="recolher" size="sm" tone={ativo ? 'accent' : 'body'} />
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={styles.fundo}>
          <View style={styles.folha}>
            <Text variant="subheading">{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(opcao) => opcao.value}
              renderItem={({ item }) => (
                <ListItem
                  accessibilityLabel={item.label}
                  onPress={() => escolher(item.value)}
                  // O escolhido ganha o ícone de confirmação: cor e peso sozinhos não bastam.
                  trailing={item.value === value ? <Icon name="sucesso" tone="accent" /> : <View />}
                  title={item.label}
                />
              )}
            />
            <Button label="Cancelar" variant="ghost" onPress={() => setAberto(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

// Linha de chips que rola na horizontal: os filtros nunca quebram linha nem cortam o rótulo.
export function LinhaDeFiltros({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.linha}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  linha: {
    gap: spacing.sm,
  },
  chip: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  neutro: {
    backgroundColor: colors.surface,
    borderColor: colors.borderMuted,
  },
  // Filtro aplicado: o fundo tingido do guia 2.0 (mesmo par da aba ativa).
  ativo: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoft,
  },
  pressionado: {
    opacity: 0.6,
  },
  fundo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: `${colors.inverted}80`,
  },
  folha: {
    maxHeight: '80%',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
});
