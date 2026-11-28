import { RefreshControl, ScrollView } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { AvisoSemInternet, Column, EmptyState, Screen, Skeleton, Snackbar, colors } from '@/ui';

import { buscarResumoCaixa } from '../fonteResumoCaixa';
import { PendentesSemDataCard } from './PendentesSemDataCard';
import { ProjecaoCaixa } from './ProjecaoCaixa';
import { SaldoAtualCard } from './SaldoAtualCard';

// Tela de saldo e projeção (US05 / EIX-51). Só exibe o que o motor de saldo devolve: nenhuma soma
// acontece no app.
export function SaldoProjecaoView() {
  // A mesma carga das listas (useDadosDaTela): recarrega ao voltar o foco sem piscar o skeleton (quem
  // acabou de lançar vê o saldo novo), a recarga que falha vira Snackbar sem apagar o saldo, e sem
  // internet a tela avisa em vez de ficar carregando.
  const tela = useDadosDaTela(buscarResumoCaixa);
  const { status, erro } = tela;
  const resumo = tela.dados;

  const vazio = status === 'pronto' && resumo !== null && resumo.quantidadeMovimentacoes === 0;

  return (
    <Screen
      underHeader
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={tela.atualizando}
            onRefresh={tela.puxarParaAtualizar}
            colors={[colors.accent]}
            tintColor={colors.accent}
            accessibilityLabel="Atualizar saldo"
          />
        }
      >
        <Column gap="lg">
          {tela.semInternet && status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

          {status === 'carregando' && (
            <Column gap="lg">
              {/* Skeleton com a forma da tela: saldo, projeção e bloco sem data. */}
              <Skeleton height="xxl" accessibilityLabel="Carregando saldo" />
              <Skeleton height="xxl" />
              <Skeleton height="xl" />
            </Column>
          )}

          {status === 'erro' && (
            <EmptyState
              title="Não foi possível carregar"
              description={erro ?? undefined}
              actionLabel="Tentar novamente"
              onAction={tela.recarregar}
            />
          )}

          {vazio && (
            <EmptyState
              title="Nenhuma movimentação ainda"
              description="Lance uma movimentação ou dívida para ver o saldo e a projeção de caixa."
            />
          )}

          {status === 'pronto' && resumo !== null && !vazio && (
            <>
              <SaldoAtualCard saldoAtualCentavos={resumo.saldoAtualCentavos} />
              <ProjecaoCaixa mesReferencia={resumo.mesReferencia} meses={resumo.projecao} anos={resumo.projecaoAnual} />
              <PendentesSemDataCard semVencimento={resumo.semVencimento} />
            </>
          )}
        </Column>
      </ScrollView>

    </Screen>
  );
}
