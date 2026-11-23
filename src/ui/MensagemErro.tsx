import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { spacing } from './tokens';

type MensagemErroProps = {
  // Em português, dizendo o que corrigir ("Informe a placa.").
  children: string;
};

// Erro de campo, igual em Input, Select e CampoData: ícone de alerta + texto em danger, anunciado como
// alerta. O ícone e o texto aparecem de relance; a cor sozinha não basta (auditoria de UI, item 14).
export function MensagemErro({ children }: MensagemErroProps) {
  return (
    <View style={styles.linha}>
      <Icon name="alerta" size="sm" tone="danger" />
      <Text accessibilityRole="alert" variant="bodySm" tone="danger" style={styles.texto}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  texto: {
    flexShrink: 1,
  },
});
