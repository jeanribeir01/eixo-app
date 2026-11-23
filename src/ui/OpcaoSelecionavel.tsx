import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';
import { colors, radius, spacing, touchTarget } from './tokens';

type OpcaoSelecionavelProps = {
  titulo: string;
  descricao?: string;
  icon?: IconName;
  selecionada: boolean;
  onPress: () => void;
  disabled?: boolean;
};

// Escolha única em forma de cartão (perfil do usuário, tipo da categoria): título, uma linha que
// explica a consequência e o círculo de rádio. Selecionada, a borda e o fundo mudam e o círculo fica
// cheio; o leitor de tela anuncia "selecionado". Cor nunca é o único indicador: o círculo cheio também
// diz.
export function OpcaoSelecionavel({ titulo, descricao, icon, selecionada, onPress, disabled = false }: OpcaoSelecionavelProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={descricao ? `${titulo}. ${descricao}` : titulo}
      accessibilityState={{ checked: selecionada, disabled }}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.cartao,
        selecionada && styles.cartaoSelecionado,
        disabled && styles.desabilitado,
        pressed && Platform.OS === 'ios' && styles.pressionado,
      ]}
    >
      {icon && (
        <View style={[styles.icone, selecionada && styles.iconeSelecionado]}>
          <Icon name={icon} tone={selecionada ? 'accent' : 'body'} />
        </View>
      )}
      <View style={styles.textos}>
        <Text weight="medium">{titulo}</Text>
        {!!descricao && (
          <Text variant="bodySm" tone="body">
            {descricao}
          </Text>
        )}
      </View>
      <View testID="opcao-radio" style={[styles.radio, selecionada && styles.radioSelecionado]}>
        {selecionada && <View testID="opcao-radio-marcado" style={styles.radioMiolo} />}
      </View>
    </Pressable>
  );
}

const RADIO = spacing.lg - spacing.xs;

const styles = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget,
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cartaoSelecionado: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  desabilitado: {
    opacity: 0.5,
  },
  pressionado: {
    backgroundColor: colors.border,
  },
  icone: {
    width: touchTarget - spacing.xs,
    height: touchTarget - spacing.xs,
    borderRadius: radius.input,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeSelecionado: {
    backgroundColor: colors.surface,
  },
  textos: {
    flex: 1,
    gap: spacing.xs,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: radius.pill,
    borderWidth: 2,
    // textBody e não borderMuted: o círculo vazio é um controle e precisa de 3:1 (WCAG 1.4.11).
    borderColor: colors.textBody,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelecionado: {
    borderColor: colors.accentStrong,
  },
  radioMiolo: {
    width: spacing.sm + spacing.xs / 2,
    height: spacing.sm + spacing.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentStrong,
  },
});
