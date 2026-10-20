import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Badge, Card, Column, Text, colors, spacing } from '@/ui';
import { useSyncStore } from './syncStore';

export type IndicadorSincronizacaoProps = {
  isOnline?: boolean;
  pendentes?: number;
  conflitos?: number;
  sincronizando?: boolean;
  atualizarAoMontar?: boolean;
};

export function IndicadorSincronizacao({
  isOnline: isOnlineProp,
  pendentes: pendentesProp,
  conflitos: conflitosProp,
  sincronizando: sincronizandoProp,
  atualizarAoMontar = true,
}: IndicadorSincronizacaoProps = {}) {
  const storeOnline = useSyncStore((state) => state.isOnline);
  const storePendentes = useSyncStore((state) => state.pendentes);
  const storeConflitos = useSyncStore((state) => state.conflitos);
  const storeSincronizando = useSyncStore((state) => state.sincronizando);
  const atualizarStatus = useSyncStore((state) => state.atualizarStatus);

  const isOnline = isOnlineProp ?? storeOnline;
  const pendentes = pendentesProp ?? storePendentes;
  const conflitos = conflitosProp ?? storeConflitos;
  const sincronizando = sincronizandoProp ?? storeSincronizando;

  useEffect(() => {
    if (atualizarAoMontar && pendentesProp === undefined && isOnlineProp === undefined) {
      atualizarStatus();
    }
  }, [atualizarAoMontar, pendentesProp, isOnlineProp, atualizarStatus]);

  // Se estiver online, sem itens pendentes na outbox e sem conflitos, não ocupa espaço visual
  if (isOnline && pendentes === 0 && conflitos === 0 && !sincronizando) {
    return null;
  }

  const textoPendencias =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? 'registo a aguardar sincronização' : 'registos a aguardar sincronização'}`
      : undefined;

  return (
    <View
      testID="indicador-sincronizacao"
      accessible
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
    >
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

          {conflitos > 0 && (
            <Text variant="bodySm" tone="muted">
              {conflitos === 1
                ? '1 conflito detectado (aguardando revisão do gestor).'
                : `${conflitos} conflitos detectados (aguardando revisão do gestor).`}
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
