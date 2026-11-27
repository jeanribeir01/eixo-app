import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button } from './Button';
import { Icon } from './Icon';
import { colors, controlHeight, fontFamily, radius, spacing, typography } from './tokens';

export type CampoBuscaProps = {
  value: string;
  onChangeText: (texto: string) => void;
  // Diz o que se procura ("Buscar por placa ou modelo"): sem rótulo visível, é o placeholder que orienta.
  placeholder: string;
  // Nome que o leitor de tela anuncia. Sem ele, anuncia o placeholder.
  accessibilityLabel?: string;
};

// Busca única das listas (Categorias, Formas de pagamento, Rotas, Veículos, Usuários). Antes cada tela
// tinha a sua: com ou sem lupa, com rótulo "Buscar", "Buscar rota" ou "Buscar forma de pagamento". Aqui
// a lupa já diz que é busca, então o rótulo acima do campo sai e o placeholder diz o que procurar.
export function CampoBusca({ value, onChangeText, placeholder, accessibilityLabel }: CampoBuscaProps) {
  const [focado, setFocado] = useState(false);

  return (
    <View style={[styles.campo, focado && styles.focado]}>
      <Icon name="buscar" tone="body" />
      <TextInput
        accessibilityLabel={accessibilityLabel ?? placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.textBody}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.texto}
      />
      {/* Só aparece com texto: limpa a busca com um toque, sem apagar letra por letra. */}
      {value !== '' && <Button variant="icon" icon="limpar" label="Limpar busca" onPress={() => onChangeText('')} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // Mesma caixa do Input (fundo, borda, raio e altura), para a busca não parecer outro componente.
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: controlHeight,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingLeft: spacing.md,
  },
  // Anel de foco de 2px em accent, como no Input (DESIGN_CYAN §7).
  focado: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  texto: {
    ...typography.body,
    flex: 1,
    fontFamily: fontFamily.regular,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
});
