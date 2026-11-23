import { StyleSheet, View } from 'react-native';

import { profileFromSession } from '@/features/auth/perfilGoogle';
import { useSessionStore } from '@/features/auth/sessionStore';
import { Avatar, Column, Text } from '@/ui';
import { spacing } from '@/ui/tokens';

import { dataPorExtenso, saudacao } from './saudacao';

type CabecalhoInicioProps = {
  nome: string;
  agora: Date;
};

// Topo do Início, igual para todos os perfis que têm a aba: foto (ou inicial), saudação e a data.
// A saudação é o título da tela (a aba não tem header nativo).
export function CabecalhoInicio({ nome, agora }: CabecalhoInicioProps) {
  // Foto do Google, a mesma da aba Conta. Sem sessão ou sem foto, o Avatar mostra a inicial.
  const session = useSessionStore((state) => state.session);
  const photoUrl = session ? profileFromSession(session).photoUrl : null;

  return (
    <View style={styles.linha}>
      <Avatar name={nome || '?'} photoUrl={photoUrl} />
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
