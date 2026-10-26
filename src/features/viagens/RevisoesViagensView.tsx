import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  Input,
  Screen,
  Snackbar,
  Text,
  colors,
  spacing,
} from '@/ui';

import { listarRevisoesPendentes, resolverRevisao } from './revisoesRepository';
import type { RevisaoViagem } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()} às ${hora}:${minuto}`;
}

export function RevisoesViagensView() {
  const tela = useDadosDaTela(listarRevisoesPendentes);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);

  const executarDecisao = useCallback(
    async (revisao: RevisaoViagem, status: 'Resolvida' | 'Descartada', observacao: string) => {
      setResolvendoId(revisao.id);
      const resultado = await resolverRevisao(revisao.id, { status, observacao });
      setResolvendoId(null);

      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }

      tela.atualizarDados((atuais) => atuais.filter((item) => item.id !== revisao.id));
      setFeedback({
        mensagem:
          status === 'Resolvida'
            ? 'Revisão marcada como resolvida.'
            : 'Revisão descartada. A viagem local não foi alterada.',
        tone: 'success',
      });
    },
    [tela],
  );

  const confirmarDecisao = useCallback(
    (revisao: RevisaoViagem, status: 'Resolvida' | 'Descartada', observacao: string) => {
      const resolvida = status === 'Resolvida';
      Alert.alert(
        resolvida ? 'Marcar revisão como resolvida?' : 'Descartar revisão?',
        resolvida
          ? 'A pendência será marcada como resolvida. A decisão fica registrada; a viagem no aparelho não é alterada.'
          : 'A revisão será encerrada sem alterar a viagem. A decisão fica registrada.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: resolvida ? 'Resolver' : 'Descartar',
            style: resolvida ? 'default' : 'destructive',
            onPress: () => {
              void executarDecisao(revisao, status, observacao);
            },
          },
        ],
      );
    },
    [executarDecisao],
  );

  return (
    <Screen
      overlay={
        feedback ? (
          <Snackbar
            message={feedback.mensagem}
            tone={feedback.tone}
            onDismiss={() => setFeedback(null)}
          />
        ) : tela.feedbackErro ? (
          <Snackbar
            message={tela.feedbackErro}
            tone="error"
            onDismiss={tela.limparFeedbackErro}
          />
        ) : undefined
      }
    >
      {tela.status === 'carregando' && (
        <View style={styles.centro}>
          <ActivityIndicator
            size="large"
            color={colors.accent}
            accessibilityLabel="Carregando revisões"
          />
        </View>
      )}

      {tela.status === 'erro' && (
        <EmptyState
          icon="viagens"
          title="Não foi possível carregar as revisões"
          description={tela.erro ?? 'Verifique sua conexão e tente novamente.'}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
      )}

      {tela.status === 'pronto' && (
        <FlatList
          data={tela.dados ?? []}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          contentContainerStyle={styles.conteudo}
          ListHeaderComponent={
            <Text variant="bodySm" tone="muted">
              Viagens que o servidor recusou e cujo dado local foi preservado. Resolver ou
              descartar aqui encerra a pendência; a viagem no aparelho não é apagada por esta tela.
            </Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="viagens"
              title="Nenhuma revisão pendente"
              description="As viagens sincronizadas com sucesso não aparecem aqui."
            />
          }
          renderItem={({ item }) => (
            <CartaoRevisao
              revisao={item}
              salvando={resolvendoId === item.id}
              onDecidir={(status, observacao) => confirmarDecisao(item, status, observacao)}
            />
          )}
        />
      )}
    </Screen>
  );
}

type CartaoRevisaoProps = {
  revisao: RevisaoViagem;
  salvando: boolean;
  onDecidir: (status: 'Resolvida' | 'Descartada', observacao: string) => void;
};

function CartaoRevisao({ revisao, salvando, onDecidir }: CartaoRevisaoProps) {
  const [observacao, setObservacao] = useState('');

  return (
    <Card>
      <Column gap="sm">
        <View style={styles.linhaTopo}>
          <Text variant="body" weight="medium">
            {revisao.veiculo_placa ?? 'Viagem sem veículo'}
            {revisao.motorista_nome ? ` • ${revisao.motorista_nome}` : ''}
          </Text>
          <Badge label="Pendente" tone="danger" />
        </View>

        {revisao.rota_trecho && (
          <Text variant="bodySm" tone="body">
            {revisao.rota_trecho}
          </Text>
        )}

        <Text variant="bodySm" tone="body">
          {revisao.mensagem}
        </Text>

        <Text variant="caption" tone="muted">
          {`Código: ${revisao.codigo} · ${formatarDataHora(revisao.data_inclusao)}`}
        </Text>

        <Input
          label="Observação (opcional)"
          placeholder="Ex.: hodômetro conferido com o motorista"
          value={observacao}
          onChangeText={setObservacao}
          multiline
          maxLength={1000}
          editable={!salvando}
        />

        <View style={styles.acoes}>
          <Button
            variant="ghost"
            label="Resolver"
            loading={salvando}
            disabled={salvando}
            onPress={() => onDecidir('Resolvida', observacao)}
          />
          <Button
            variant="ghost"
            label="Descartar"
            disabled={salvando}
            onPress={() => onDecidir('Descartada', observacao)}
          />
        </View>
      </Column>
    </Card>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  conteudo: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centro: {
    flex: 1,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
