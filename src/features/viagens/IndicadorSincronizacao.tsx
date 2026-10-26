import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Badge, Card, Column, Text, colors, spacing } from '@/ui';

import { useSyncStore } from './syncStore';

export type IndicadorSincronizacaoProps = {
  isOnline?: boolean;
  pendentes?: number;
  comErro?: number;
  /** Nome antigo mantido para os testes/chamadas que ainda passam `conflitos`. */
  conflitos?: number;
  emRevisao?: number;
  sincronizando?: boolean;
  atualizarAoMontar?: boolean;
};

export function IndicadorSincronizacao({
  isOnline: isOnlineProp,
  pendentes: pendentesProp,
  comErro: comErroProp,
  conflitos: conflitosProp,
  emRevisao: emRevisaoProp,
  sincronizando: sincronizandoProp,
  atualizarAoMontar = true,
}: IndicadorSincronizacaoProps = {}) {
  const storeOnline = useSyncStore((state) => state.isOnline);
  const storePendentes = useSyncStore((state) => state.pendentes);
  const storeComErro = useSyncStore((state) => state.comErro);
  const storeEmRevisao = useSyncStore((state) => state.emRevisao);
  const storeSincronizando = useSyncStore((state) => state.sincronizando);
  const atualizarStatus = useSyncStore((state) => state.atualizarStatus);

  const isOnline = isOnlineProp ?? storeOnline;
  const pendentes = pendentesProp ?? storePendentes;
  const comErro = comErroProp ?? storeComErro;
  const emRevisao = emRevisaoProp ?? conflitosProp ?? storeEmRevisao;
  const sincronizando = sincronizandoProp ?? storeSincronizando;

  useEffect(() => {
    if (atualizarAoMontar && pendentesProp === undefined && isOnlineProp === undefined) {
      atualizarStatus();
    }
  }, [atualizarAoMontar, pendentesProp, isOnlineProp, atualizarStatus]);

  // Online, sem pendência, sem erro e sem revisão: não ocupa espaço visual.
  if (isOnline && pendentes === 0 && emRevisao === 0 && comErro === 0 && !sincronizando) {
    return null;
  }

  const textoPendencias =
    pendentes > 0
      ? `${pendentes} ${pendentes === 1 ? 'registro aguardando sincronização' : 'registros aguardando sincronização'}`
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
            {!isOnline && <Badge label="Offline" tone="neutral" />}
            {sincronizando && (
              <View style={styles.carregando}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text variant="caption" tone="muted">
                  Sincronizando...
                </Text>
              </View>
            )}
          </View>

          {textoPendencias && (
            <Text variant="bodySm" tone="body">
              {textoPendencias}
            </Text>
          )}

          {!isOnline && (
            <Text variant="bodySm" tone="muted">
              {pendentes === 0
                ? 'As operações serão guardadas no dispositivo e enviadas quando a internet voltar.'
                : 'Os registros serão enviados quando a internet voltar.'}
            </Text>
          )}

          {comErro > 0 && (
            <Text variant="bodySm" tone="muted">
              {comErro === 1
                ? '1 registro não pôde ser enviado. Nova tentativa automática em instantes.'
                : `${comErro} registros não puderam ser enviados. Nova tentativa automática em instantes.`}
            </Text>
          )}

          {emRevisao > 0 && (
            <Text variant="bodySm" tone="muted">
              {emRevisao === 1
                ? '1 registro está em revisão com o gestor.'
                : `${emRevisao} registros estão em revisão com o gestor.`}
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
