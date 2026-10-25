import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Badge, Card, Column, Text, colors, spacing } from '@/ui';

import { useSyncStore } from './syncStore';

function plural(total: number, singular: string, varios: string): string {
  return `${total} ${total === 1 ? singular : varios}`;
}

// Estado da sincronização para o motorista saber o que já subiu (CLAUDE.md §7, item 6):
// offline, pendente, enviando, falha e conflito. Some quando está tudo em dia.
export function IndicadorSincronizacao() {
  const isOnline = useSyncStore((state) => state.isOnline);
  const pendentes = useSyncStore((state) => state.pendentes);
  const falhas = useSyncStore((state) => state.falhas);
  const conflitos = useSyncStore((state) => state.conflitos);
  const sincronizando = useSyncStore((state) => state.sincronizando);

  if (isOnline && !sincronizando && pendentes === 0 && falhas === 0 && conflitos === 0) {
    return null;
  }

  return (
    <View testID="indicador-sincronizacao" accessible accessibilityRole="summary" accessibilityLiveRegion="polite">
      <Card>
        <Column gap="xs">
          {(!isOnline || sincronizando) && (
            <View style={styles.linha}>
              {!isOnline && <Badge label="Offline" tone="neutral" />}
              {sincronizando && (
                <>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text variant="caption" tone="muted">
                    Sincronizando…
                  </Text>
                </>
              )}
            </View>
          )}

          {pendentes > 0 && (
            <Text variant="bodySm" tone="body">
              {plural(pendentes, 'registro aguardando sincronização.', 'registros aguardando sincronização.')}
            </Text>
          )}

          {!isOnline && pendentes === 0 && (
            <Text variant="bodySm" tone="muted">
              O que você registrar fica salvo no aparelho e é enviado quando a internet voltar.
            </Text>
          )}

          {falhas > 0 && (
            <Text variant="bodySm" tone="body">
              {plural(falhas, 'registro recusado pelo servidor.', 'registros recusados pelo servidor.')}
            </Text>
          )}

          {conflitos > 0 && (
            <Text variant="bodySm" tone="body">
              {plural(
                conflitos,
                'conflito de hodômetro aguardando revisão do gestor.',
                'conflitos de hodômetro aguardando revisão do gestor.',
              )}
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
});
