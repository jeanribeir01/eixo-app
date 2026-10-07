import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { Button, Column, EmptyState, ListItem, Screen, Snackbar, Text, colors, spacing } from '@/ui';
import { formatarMoeda } from '@/lib/money';

import { listarDividas } from '../dividasRepository';
import type { Divida } from '../types';

type Status = 'carregando' | 'pronto' | 'erro';
type Feedback = { mensagem: string; tone: 'success' | 'error' };

export function DividasListView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const carregar = useCallback(async () => {
    setStatus('carregando');
    const resultado = await listarDividas();

    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setDividas(resultado.data);
    setStatus('pronto');
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.base }}>
        <Column gap="xs">
          <Text variant="bodySm" weight="medium">
            Eixo Certo
          </Text>
          <Text variant="heading">Dívidas e Financiamentos</Text>
        </Column>
      </View>

      <View style={{ padding: spacing.base }}>
        <Button label="Nova Dívida" variant="primary" onPress={() => router.push('/dividas/nova')} />
      </View>

      {status === 'carregando' && (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando dívidas" />
        </View>
      )}

      {status === 'erro' && (
        <EmptyState
          title="Não foi possível carregar"
          description={erro ?? 'Erro desconhecido'}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      )}

      {status === 'pronto' && dividas.length === 0 && (
        <EmptyState
          title="Nenhuma dívida encontrada"
          description="Você ainda não registrou nenhuma dívida ou financiamento."
        />
      )}

      {status === 'pronto' && dividas.length > 0 && (
        <FlatList
          data={dividas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListItem onPress={() => router.push(`/dividas/${item.id}`)} accessibilityLabel={`Dívida ${item.descricao}`}>
              <Column gap="xs">
                <Text variant="body" weight="medium" tone="primary">{item.descricao}</Text>
                <Column direction="row" gap="md">
                  <Text variant="bodySm" tone="body">{formatarMoeda(item.somaTotalCentavos)}</Text>
                  <Text variant="bodySm" tone="muted">
                    {item.parcelasPagas} de {item.quantidadeParcelas} parcelas pagas
                  </Text>
                </Column>
              </Column>
            </ListItem>
          )}
        />
      )}

      {feedback && (
        <Snackbar
          message={feedback.mensagem}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      )}
    </Screen>
  );
}
