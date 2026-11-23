import { StyleSheet, View } from 'react-native';

import { Avatar, Column, Text } from '@/ui';
import { spacing } from '@/ui/tokens';

import { dataPorExtenso, saudacao } from './saudacao';

type CabecalhoInicioProps = {
  nome: string;
  agora: Date;
};

// Topo do Início, igual para todos os perfis que têm a aba: inicial do nome, saudação e a data.
// A saudação é o título da tela (a aba não tem header nativo).
export function CabecalhoInicio({ nome, agora }: CabecalhoInicioProps) {
  return (
    <View style={styles.linha}>
      <Avatar name={nome || '?'} photoUrl={null} />
      <Column gap="xs">
        <Text variant="subheading" accessibilityRole="header">
          {saudacao(agora, nome)}
        </Text>
        <Text variant="bodySm" tone="body">
          {dataPorExtenso(agora)}
        </Text>
      </Column>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
