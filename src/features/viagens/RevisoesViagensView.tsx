import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Aviso,
  AvisoSemInternet,
  Button,
  Card,
  Column,
  EmptyState,
  FolhaDeConfirmacao,
  Input,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
  useScreenColumn,
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
  const coluna = useScreenColumn();

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

  // Decisão esperando o "sim" da folha: qual revisão, o que fazer e a observação digitada.
  const [decisao, setDecisao] = useState<{
    revisao: RevisaoViagem;
    status: 'Resolvida' | 'Descartada';
    observacao: string;
  } | null>(null);
  const confirmarDecisao = useCallback(
    (revisao: RevisaoViagem, status: 'Resolvida' | 'Descartada', observacao: string) =>
      setDecisao({ revisao, status, observacao }),
    [],
  );
  const resolvida = decisao?.status === 'Resolvida';

  return (
    // Tela interna, sob o header nativo "Revisões de viagens": o header já protege o topo, então o Screen
    // não repete o inset (NAV-04). Sem isso sobrava uma faixa vazia entre o header e o conteúdo.
    <Screen
      underHeader
      list
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
      {/* Na coluna: no tablet o esboço e o texto do erro não se espalham pela largura toda (EIX-94). */}
      <ScreenColumn>
        {tela.semInternet && tela.status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

        {tela.status === 'carregando' && (
          <Column gap="lg">
            <Skeleton height="xxl" accessibilityLabel="Carregando revisões" />
            <Skeleton height="xxl" />
          </Column>
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
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <FlatList
          // No celular a lista fica dentro do respiro lateral da tela: a barra de rolagem do Android
          // aparecia por cima das setas e dos valores das linhas.
          showsVerticalScrollIndicator={false}
          data={tela.dados ?? []}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.conteudo]}
          // Do ponto de vista do gestor, não do sistema: o que aconteceu, o que fazer e o que não se perde.
          ListHeaderComponent={
            <Text tone="body">
              Viagens que o motorista registrou sem internet e que não puderam ser gravadas, como um hodômetro
              menor que o anterior. Confira cada uma com ele e marque como resolvida ou descarte. Nada aqui
              apaga a viagem do aparelho do motorista.
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

      <FolhaDeConfirmacao
        visivel={decisao !== null}
        titulo={resolvida ? 'Marcar revisão como resolvida?' : 'Descartar revisão?'}
        mensagem={
          resolvida
            ? 'A pendência será marcada como resolvida. A decisão fica registrada; a viagem no aparelho não é alterada.'
            : 'A revisão será encerrada sem alterar a viagem. A decisão fica registrada.'
        }
        rotuloConfirmar={resolvida ? 'Resolver' : 'Descartar'}
        tom={resolvida ? 'primary' : 'danger'}
        onConfirmar={() => {
          const escolhida = decisao;
          setDecisao(null);
          if (escolhida) void executarDecisao(escolhida.revisao, escolhida.status, escolhida.observacao);
        }}
        onCancelar={() => setDecisao(null)}
      />
    </Screen>
  );
}

type CartaoRevisaoProps = {
  revisao: RevisaoViagem;
  salvando: boolean;
  onDecidir: (status: 'Resolvida' | 'Descartada', observacao: string) => void;
};

// Uma revisão: primeiro o porquê (o motivo da recusa, num aviso), depois de qual viagem se trata e, por fim, a
// decisão. Os dois botões empilhados ocupam a largura toda; o descarte usa o estilo de ação grave.
function CartaoRevisao({ revisao, salvando, onDecidir }: CartaoRevisaoProps) {
  const [observacao, setObservacao] = useState('');

  return (
    <Column gap="md">
      <Aviso tom="danger" icone="alerta" titulo="Esta viagem não pôde ser gravada">
        {revisao.mensagem}
      </Aviso>

      <Card>
        {revisao.rota_trecho && (
          <Text variant="bodySm" tone="body">
            {revisao.rota_trecho}
          </Text>
        )}
        <Text variant="subheading" weight="semibold">
          {revisao.veiculo_placa ?? 'Viagem sem veículo'}
        </Text>
        <Text tone="body">
          {[revisao.motorista_nome, `registrada em ${formatarDataHora(revisao.data_inclusao)}`]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Text variant="caption" tone="body">{`Código: ${revisao.codigo}`}</Text>
      </Card>

      <Input
        label="Observação (opcional)"
        placeholder="Ex.: hodômetro conferido com o motorista"
        value={observacao}
        onChangeText={setObservacao}
        multiline
        maxLength={1000}
        editable={!salvando}
      />

      <Column gap="sm">
        <Button
          variant="ghost"
          label="Resolver revisão"
          loading={salvando}
          disabled={salvando}
          onPress={() => onDecidir('Resolvida', observacao)}
        />
        <Button
          variant="danger"
          label="Descartar revisão"
          disabled={salvando}
          onPress={() => onDecidir('Descartada', observacao)}
        />
      </Column>
    </Column>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  // Espaço maior entre revisões do que dentro de uma: cada uma é um bloco de decisão separado.
  conteudo: {
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
});
