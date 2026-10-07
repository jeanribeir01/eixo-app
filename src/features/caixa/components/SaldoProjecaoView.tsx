import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { RefreshControl, ScrollView, useWindowDimensions } from 'react-native';

import { Column, EmptyState, Screen, Skeleton, Snackbar, colors } from '@/ui';

import { buscarResumoCaixa } from '../fonteResumoCaixa';
import { PendentesSemDataCard } from './PendentesSemDataCard';
import { ProjecaoMensalLista } from './ProjecaoMensalLista';
import type { ResumoCaixa } from '../resumoCaixa';
import { SaldoAtualCard } from './SaldoAtualCard';

type Status = 'carregando' | 'pronto' | 'erro';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

// A partir desta largura (tablet) a projeção vira uma linha por mês, como tabela (RNF02).
const LARGURA_TABLET = 768;

// Tela de saldo e projeção (US05 / EIX-51). Só exibe o que o motor de saldo devolve: nenhuma soma
// acontece no app.
export function SaldoProjecaoView() {
  const { width } = useWindowDimensions();
  const largo = width >= LARGURA_TABLET;

  const [status, setStatus] = useState<Status>('carregando');
  const [resumo, setResumo] = useState<ResumoCaixa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Já existe resumo na tela? Ref em vez de ler `resumo`: o callback abaixo não pode depender do
  // state, senão o useFocusEffect rodaria de novo a cada carga.
  const temResumo = useRef(false);

  const carregar = useCallback(async () => {
    // Skeleton só quando ainda não há nada para mostrar. Ao voltar o foco com o saldo na tela, o
    // dado novo só substitui o antigo, sem a tela piscar.
    if (!temResumo.current) setStatus('carregando');

    const resultado = await buscarResumoCaixa();
    if (!resultado.ok) {
      // Recarga em segundo plano que falha não apaga o saldo que o usuário já está vendo.
      if (temResumo.current) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }

    temResumo.current = true;
    setResumo(resultado.data);
    setStatus('pronto');
  }, []);

  // Recarrega sempre que a tela volta ao foco: quem acabou de lançar movimentação/dívida vê o saldo novo.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  // Pull-to-refresh mantém o conteúdo na tela (sem skeleton) e só troca quando o dado novo chega.
  async function handleAtualizar() {
    setAtualizando(true);
    const resultado = await buscarResumoCaixa();
    setAtualizando(false);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    temResumo.current = true;
    setResumo(resultado.data);
    setStatus('pronto');
    setFeedback({ mensagem: 'Saldo atualizado.', tone: 'success' });
  }

  const vazio = status === 'pronto' && resumo !== null && resumo.quantidadeMovimentacoes === 0;

  return (
    <Screen
      underHeader
      overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />}
    >
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={handleAtualizar}
            colors={[colors.accent]}
            tintColor={colors.accent}
            accessibilityLabel="Atualizar saldo"
          />
        }
      >
        <Column gap="lg">
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
              onAction={carregar}
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
              <ProjecaoMensalLista meses={resumo.projecao} largo={largo} />
              <PendentesSemDataCard semVencimento={resumo.semVencimento} />
            </>
          )}
        </Column>
      </ScrollView>

    </Screen>
  );
}
