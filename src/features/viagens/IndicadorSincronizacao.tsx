import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Badge, Card, Column, Text, colors, spacing } from '@/ui';
import { useSyncStore } from './syncStore';

export function IndicadorSincronizacao() {
  const isOnline = useSyncStore((state) => state.isOnline);
  const pendentes = useSyncStore((state) => state.pendentes);
  const sincronizando = useSyncStore((state) => state.sincronizando);
  const atualizarStatus = useSyncStore((state) => state.atualizarStatus);

  useEffect(() => {
    atualizarStatus();
  }, [atualizarStatus]);

  // Se estiver online e sem itens pendentes na outbox, não ocupa espaço visual
  if (isOnline && pendentes === 0 && !sincronizando) {
    return null;
  }

  const textoPendencias =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? 'registo a aguardar sincronização' : 'registos a aguardar sincronização'}`
      : undefined;

  return (
    <View testID="indicador-sincronizacao" accessibilityRole="status">
      <Card>
        <Column gap="xs">
          <View style={styles.linha}>
            {!isOnline && <Badge label="offline" tone="neutral" />}
            {sincronizando && (
              <View style={styles.carregando}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text variant="caption" tone="muted">
                  A sincronizar...
                </Text>
              </View>
            )}
          </View>

          {textoPendencias && (
            <Text variant="bodySm" tone="body">
              {textoPendencias}
            </Text>
          )}

          {!isOnline && pendentes === 0 && (
            <Text variant="bodySm" tone="muted">
              As operações serão guardadas no dispositivo e enviadas quando a internet voltar.
            </Text>
          )}
        </Column>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  carregando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
