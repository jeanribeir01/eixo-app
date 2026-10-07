import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { ListItem } from './ListItem';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

export type SelectOption = { value: string; label: string; description?: string };

export type SelectProps = {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  // Mesma regra do Input: mensagem em português abaixo do campo, nunca só a borda.
  error?: string;
  emptyMessage?: string;
  // Rótulo para um valor que não está nas opções — ex.: categoria desativada num lançamento
  // antigo. Some do seletor (soft delete), mas o lançamento continua mostrando o nome.
  fallbackLabel?: string;
  disabled?: boolean;
};

// Campo de escolha com a aparência do Input. Abre a lista num Modal do próprio React Native,
// sem biblioteca de picker: funciona igual em Android e iOS e usa só os primitivos da casa.
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione',
  error,
  emptyMessage = 'Nenhuma opção disponível.',
  fallbackLabel,
  disabled = false,
}: SelectProps) {
  const [aberto, setAberto] = useState(false);

  const escolhida = options.find((opcao) => opcao.value === value);
  const textoAtual = escolhida?.label ?? (value ? fallbackLabel : undefined);

  function escolher(novoValor: string) {
    setAberto(false);
    onChange(novoValor);
  }

  return (
    <View style={styles.wrapper}>
      <Text variant="bodySm" tone="body" weight="medium">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: aberto }}
        disabled={disabled}
        onPress={() => setAberto(true)}
        style={({ pressed }) => [styles.campo, !!error && styles.erro, (pressed || disabled) && styles.dimmed]}
      >
        <Text tone={textoAtual ? 'primary' : 'body'}>{textoAtual ?? placeholder}</Text>
      </Pressable>
      {!!error && (
        <Text accessibilityRole="alert" variant="bodySm">
          {error}
        </Text>
      )}

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <View style={styles.fundo}>
          <View style={styles.folha}>
            <Text variant="subheading">{label}</Text>
            {options.length === 0 ? (
              <Text tone="body">{emptyMessage}</Text>
            ) : (
              <FlatList
                data={options}
                keyExtractor={(opcao) => opcao.value}
                renderItem={({ item }) => (
                  <ListItem accessibilityLabel={item.label} onPress={() => escolher(item.value)}>
                    <Text weight={item.value === value ? 'medium' : 'regular'}>{item.label}</Text>
                    {!!item.description && (
                      <Text variant="bodySm" tone="body">
                        {item.description}
                      </Text>
                    )}
                  </ListItem>
                )}
              />
            )}
            <Button label="Cancelar" variant="ghost" onPress={() => setAberto(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  campo: {
    minHeight: touchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  // Igual ao Input: reforço discreto na borda; a mensagem abaixo é o indicador real.
  erro: {
    borderColor: colors.textPrimary,
  },
  dimmed: {
    opacity: 0.6,
  },
  // Véu sobre a tela usa a superfície invertida translúcida, sem cor nova.
  fundo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: `${colors.inverted}80`,
  },
  folha: {
    maxHeight: '80%',
    gap: spacing.md,
    padding: spacing.base,
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.feature,
    borderTopRightRadius: radius.feature,
  },
});
