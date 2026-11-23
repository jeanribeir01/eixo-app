import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { formatarIndicador } from '@/features/bi/formatar';
import type { EstatisticaRota, EstatisticaVeiculo } from '@/features/bi/queries';
import { ExportarRelatorio } from '@/features/relatorios/export/ExportarRelatorio';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { useMenu } from '@/navigation/menu';
import { Column, EmptyState, ListSection, Screen, Skeleton, Snackbar, Tabs, Text, type SnackbarTone } from '@/ui';
import { motion } from '@/ui/tokens';
import { useReducedMotion } from '@/ui/useReducedMotion';

import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { GraficosCaixa } from '../graficos/GraficosCaixa';
import { mesAtual, type Periodo } from '../periodo';
import { LinhaRanking } from './components/LinhaRanking';
import { buscarRanking, type ItemRanqueado, type Ranking } from './ranking';

type Visao = 'rotas' | 'veiculos';

const VISOES: { label: string; value: Visao }[] = [
  { label: 'Rotas', value: 'rotas' },
  { label: 'Veículos', value: 'veiculos' },
];

// Mesmo texto do cadastro de Rotas: "Curitiba/PR → São Paulo/SP".
function trecho(rota: EstatisticaRota): string {
  return `${rota.cidade_origem}/${rota.uf_origem} → ${rota.cidade_destino}/${rota.uf_destino}`;
}

function viagens(quantidade: number): string {
  return quantidade === 1 ? '1 viagem' : `${quantidade} viagens`;
}

// Vírgula decimal e uma casa ("408,5 km"), como o KM das telas de Viagem (formatarKm). O cadastro de
// Rotas mostra a distância estimada com até duas casas; aqui é KM rodado somado, uma casa basta.
function km(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

// O vazio tem motivos diferentes, e "finalize uma viagem" só serve quando de fato não houve viagem.
function descricaoDoVazio(ranking: Ranking, visao: Visao): string {
  if (visao === 'rotas' && ranking.rotasSemLucro) {
    return 'Nenhuma rota deu lucro nas viagens finalizadas no período. Escolha outro período.';
  }
  if (visao === 'veiculos' && ranking.veiculosSemKm) {
    return 'Os veículos com viagem finalizada no período não rodaram KM, então não há custo por KM para comparar.';
  }
  return 'O ranking usa as viagens finalizadas no período. Escolha outro período ou finalize uma viagem.';
}

// Aba Dashboards — ranking de eficiência logística (US13, EIX-46). Top 3 rotas mais lucrativas e Top 3
// veículos com maior custo por KM no período do filtro. Tudo vem calculado das RPCs da US10; a tela
// só exibe. Os gráficos de caixa da US12 (EIX-45) entram nesta mesma aba, sob o mesmo filtro.
export function RankingView() {
  const router = useRouter();
  // O detalhe de rota e de veículo é da Frota (Admin e Gestor). O Financeiro vê o ranking, sem toque.
  // Os gráficos de caixa são do Financeiro (Admin e Financeiro, a mesma regra das Categorias): o Gestor
  // de Frota não lê movimentação, e as RPCs devolveriam 42501 para ele.
  const { podeVerFrota, podeVerCategorias: podeVerCaixa } = useMenu();
  const reduzirMovimento = useReducedMotion();

  const [periodo, setPeriodo] = useState<Periodo>(mesAtual);
  const [visao, setVisao] = useState<Visao>('rotas');
  const [erroGraficos, setErroGraficos] = useState<string | null>(null);
  // Resultado da exportação (US14): sucesso ou erro, no mesmo Snackbar da tela.
  const [feedbackExportacao, setFeedbackExportacao] = useState<{ mensagem: string; tom: SnackbarTone } | null>(null);

  // Uma consulta por período: trocar de mês volta ao skeleton, trocar de aba não consulta de novo.
  const buscar = useCallback(
    () => buscarRanking({ dataInicial: periodo.dataInicial, dataFinal: periodo.dataFinal }),
    [periodo.dataInicial, periodo.dataFinal],
  );
  const tela = useDadosDaTela(buscar);

  function trocarVisao(valor: string) {
    const nova = VISOES.find((opcao) => opcao.value === valor)?.value;
    if (nova) setVisao(nova);
  }

  function linhaRota({ item, posicao, empatado }: ItemRanqueado<EstatisticaRota>) {
    return (
      <LinhaRanking
        key={item.rota_id}
        posicao={posicao}
        empatado={empatado}
        titulo={trecho(item)}
        subtitulo={`${viagens(item.quantidade_viagens)} · ${km(item.km_total)}`}
        rotuloMetrica="Lucro"
        metrica={formatarIndicador(item.lucro_centavos, 'moeda')}
        // A rota só tem a tela de edição; é nela que o gestor vê o trecho e a distância.
        onPress={podeVerFrota ? () => router.push(`/rotas/${item.rota_id}/editar`) : undefined}
      />
    );
  }

  function linhaVeiculo({ item, posicao, empatado }: ItemRanqueado<EstatisticaVeiculo>) {
    return (
      <LinhaRanking
        key={item.veiculo_id}
        posicao={posicao}
        empatado={empatado}
        titulo={item.placa}
        subtitulo={`${item.marca} ${item.modelo} · ${viagens(item.quantidade_viagens)}`}
        rotuloMetrica="Custo por KM"
        metrica={formatarIndicador(item.custo_por_km_centavos, 'custoPorKm')}
        onPress={podeVerFrota ? () => router.push(`/frota/${item.veiculo_id}`) : undefined}
      />
    );
  }

  function conteudo() {
    if (tela.status === 'carregando') {
      // Skeleton com a forma do Top 3: três linhas.
      return (
        <Column gap="sm">
          <Skeleton height="xxl" accessibilityLabel="Carregando ranking" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
      );
    }

    if (tela.status === 'erro' || tela.dados === null) {
      return (
        <EmptyState
          icon="dashboards"
          title="Não foi possível carregar"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
      );
    }

    const ranking = tela.dados;
    const vazio =
      visao === 'rotas' ? ranking.rotasMaisLucrativas.length === 0 : ranking.veiculosMaiorCustoPorKm.length === 0;

    if (vazio) {
      return (
        <EmptyState
          icon={visao === 'rotas' ? 'rotas' : 'frota'}
          title="Ainda sem dados para ranquear"
          description={descricaoDoVazio(ranking, visao)}
        />
      );
    }

    return visao === 'rotas' ? (
      <ListSection label="Top 3 rotas mais lucrativas">{ranking.rotasMaisLucrativas.map(linhaRota)}</ListSection>
    ) : (
      <ListSection label="Top 3 veículos com maior custo por KM">
        {ranking.veiculosMaiorCustoPorKm.map(linhaVeiculo)}
      </ListSection>
    );
  }

  // Um Snackbar por vez no overlay: erro do ranking, depois erro dos gráficos, depois a exportação.
  function snackbar() {
    if (tela.feedbackErro) {
      return <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />;
    }
    if (erroGraficos) {
      return <Snackbar message={erroGraficos} tone="error" onDismiss={() => setErroGraficos(null)} />;
    }
    if (feedbackExportacao) {
      return (
        <Snackbar
          message={feedbackExportacao.mensagem}
          tone={feedbackExportacao.tom}
          onDismiss={() => setFeedbackExportacao(null)}
        />
      );
    }
    return null;
  }

  return (
    <Screen scroll overlay={snackbar()}>
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Dashboards</Text>

      <FiltroPeriodo value={periodo} onChange={setPeriodo} />

      {/* Exportação da US14 (EIX-47): mesmo período do filtro e mesma regra de perfil dos gráficos. */}
      {podeVerCaixa && (
        <ExportarRelatorio periodo={periodo} onFeedback={(mensagem, tom) => setFeedbackExportacao({ mensagem, tom })} />
      )}

      {podeVerCaixa && <GraficosCaixa periodo={periodo} onErroAoAtualizar={setErroGraficos} />}

      <Column gap="md">
        <Text variant="subheading">Ranking de eficiência</Text>
        <Tabs options={VISOES} value={visao} onChange={trocarVisao} accessibilityLabel="Visão do ranking" />
        {/* A chave troca com a aba e o período: o conteúdo novo entra com um fade curto, a mesma duração
            das listas do app. Com "remover animações" ligado no aparelho, troca direto. */}
        <Animated.View
          key={`${visao}-${tela.status}`}
          entering={reduzirMovimento ? undefined : FadeIn.duration(motion.listDuration)}
        >
          {conteudo()}
        </Animated.View>
      </Column>
    </Screen>
  );
}
