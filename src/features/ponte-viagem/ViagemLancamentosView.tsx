import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { Button, Card, Column, EmptyState, ListItem, ListSection, Screen, Snackbar, Text, colors } from '@/ui';

import {
  buscarViagemVinculavel,
  descricaoViagem,
  desvincularLancamento,
  listarLancamentosDaViagem,
  type LancamentoDaViagem,
  type Resultado,
  type ViagemVinculavel,
} from './ponteRepository';

type DadosDoDetalhe = { viagem: ViagemVinculavel; lancamentos: LancamentoDaViagem[] };
type Feedback = { mensagem: string; tone: 'success' | 'error' };

// As duas consultas saem juntas; qualquer falha vira o estado de erro da tela.
async function buscarDetalhe(viagemId: string): Promise<Resultado<DadosDoDetalhe>> {
  const [viagem, lancamentos] = await Promise.all([
    buscarViagemVinculavel(viagemId),
    listarLancamentosDaViagem(viagemId),
  ]);
  if (!viagem.ok) return viagem;
  if (!lancamentos.ok) return lancamentos;
  return { ok: true, data: { viagem: viagem.data, lancamentos: lancamentos.data } };
}

// Cor nunca sozinha: o sinal + / − acompanha sempre (DESIGN_CYAN, cores semânticas).
function ValorComSinal({ lancamento }: { lancamento: LancamentoDaViagem }) {
  const entrada = lancamento.categoria.tipo === 'Entrada';
  return (
    <Text weight="medium" tone={entrada ? 'success' : 'danger'}>
      {`${entrada ? '+' : '−'} ${formatarMoeda(lancamento.valorCentavos)}`}
    </Text>
  );
}

// "Combustível · 412,5 L": os litros aparecem porque são o dado do KM/L da US10.
function subtitulo(lancamento: LancamentoDaViagem): string {
  if (lancamento.litros === null) return lancamento.categoria.titulo;
  return `${lancamento.categoria.titulo} · ${String(lancamento.litros).replace('.', ',')} L`;
}

export type ViagemLancamentosViewProps = {
  viagemId: string;
};

// Detalhe da viagem para o Financeiro (US09): quem é a viagem e o que foi lançado nela, separado
// em entradas e saídas. Os totais e o custo por KM ficam para a US10, calculados no banco (RNF06).
export function ViagemLancamentosView({ viagemId }: ViagemLancamentosViewProps) {
  const router = useRouter();
  const buscar = useCallback(() => buscarDetalhe(viagemId), [viagemId]);
  const tela = useDadosDaTela(buscar);
  const [desvinculando, setDesvinculando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function desvincular(lancamento: LancamentoDaViagem) {
    if (desvinculando) return;
    setDesvinculando(lancamento.id);
    const resultado = await desvincularLancamento(lancamento.id);
    setDesvinculando(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }
    // A linha sai da lista sem recarregar a tela; o lançamento continua no Caixa.
    tela.atualizarDados((atuais) => ({
      ...atuais,
      lancamentos: atuais.lancamentos.filter((item) => item.id !== lancamento.id),
    }));
    setFeedback({ mensagem: 'Lançamento desvinculado.', tone: 'success' });
  }

  function novaMovimentacao() {
    router.push({ pathname: '/movimentacoes/nova', params: { viagemId } });
  }

  if (tela.status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando viagem" />
      </Screen>
    );
  }

  if (tela.status === 'erro' || !tela.dados) {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          icon="viagens"
          title="Não foi possível carregar a viagem"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const { viagem, lancamentos } = tela.dados;
  const entradas = lancamentos.filter((lancamento) => lancamento.categoria.tipo === 'Entrada');
  const saidas = lancamentos.filter((lancamento) => lancamento.categoria.tipo === 'Saida');

  function renderizarLinha(lancamento: LancamentoDaViagem) {
    return (
      <ListItem
        key={lancamento.id}
        title={lancamento.descricao}
        subtitle={subtitulo(lancamento)}
        trailing={<ValorComSinal lancamento={lancamento} />}
        accessibilityLabel={`Editar ${lancamento.descricao}`}
        onPress={() => router.push(`/movimentacoes/${lancamento.id}/editar`)}
        control={
          <Button
            label="Desvincular"
            variant="ghost"
            loading={desvinculando === lancamento.id}
            onPress={() => desvincular(lancamento)}
          />
        }
      />
    );
  }

  return (
    // O título "Viagem" fica no header; placa e rota aparecem no cartão porque são dado.
    <Screen
      underHeader
      scroll
      overlay={
        feedback ? (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />
        ) : tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <Column gap="lg">
        <Card variant="feature">
          <Column gap="xs">
            <Text variant="subheading">{viagem.placa}</Text>
            <Text tone="body">{`${viagem.cidade_origem}/${viagem.uf_origem} → ${viagem.cidade_destino}/${viagem.uf_destino}`}</Text>
            <Text variant="bodySm" weight="medium">
              {descricaoViagem(viagem)}
            </Text>
          </Column>
        </Card>

        {lancamentos.length === 0 ? (
          <EmptyState
            icon="movimentacoes"
            title="Nenhum lançamento vinculado"
            description="Frete, combustível e pedágio desta viagem aparecem aqui."
            actionLabel="Nova movimentação"
            onAction={novaMovimentacao}
          />
        ) : (
          <>
            {entradas.length > 0 && <ListSection label="Entradas">{entradas.map(renderizarLinha)}</ListSection>}
            {saidas.length > 0 && <ListSection label="Saídas">{saidas.map(renderizarLinha)}</ListSection>}
          </>
        )}
      </Column>
    </Screen>
  );
}
