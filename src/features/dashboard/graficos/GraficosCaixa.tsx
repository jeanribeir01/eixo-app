import { useCallback, useEffect, useState } from 'react';

import { hojeISO } from '@/lib/datas';
import { useDadosDaTela, type DadosDaTela } from '@/lib/useDadosDaTela';
import { Card, Column, EmptyState, Skeleton, Tabs, TituloSecao } from '@/ui';

import type { Periodo } from '../periodo';
import { GraficoBarras } from './GraficoBarras';
import { GraficoRosca } from './GraficoRosca';
import { HORIZONTE_PADRAO, horizonteDaOpcao, mesFinalDoGrafico, OPCOES_HORIZONTE } from './geometria';
import { buscarDespesasPorCategoria, buscarFluxoMensal } from './queries';

type GraficosCaixaProps = {
  // O período do FiltroPeriodo da aba Dashboards (o mesmo do ranking).
  periodo: Periodo;
  // Erro ao recarregar com o gráfico já na tela (ex.: voltar à aba sem internet). O gráfico fica, e
  // a tela mostra o Snackbar no overlay dela: este componente não tem Screen própria.
  onErroAoAtualizar: (mensagem: string) => void;
};

function Carregando({ rotulo }: { rotulo: string }) {
  return (
    <Column gap="sm">
      <Skeleton height="xxl" accessibilityLabel={rotulo} />
      <Skeleton height="xxl" />
      <Skeleton height="xxl" />
    </Column>
  );
}

function Erro<T>({ tela }: { tela: DadosDaTela<T> }) {
  return (
    <EmptyState
      icon="saldo"
      title="Não foi possível carregar"
      description={tela.erro ?? undefined}
      actionLabel="Tentar novamente"
      onAction={tela.recarregar}
    />
  );
}

// Gráficos de fluxo de caixa da aba Dashboards (US12, EIX-45), para Admin e Financeiro. Dois gráficos
// com consultas independentes: um falhar não apaga o outro. As barras têm horizonte próprio (3 meses a
// "Máximo") e terminam no mês final do filtro; a rosca usa o período do filtro.
export function GraficosCaixa({ periodo, onErroAoAtualizar }: GraficosCaixaProps) {
  const [opcao, setOpcao] = useState(HORIZONTE_PADRAO);
  // A opção sempre vem de OPCOES_HORIZONTE; o 6 só existe para o tipo não aceitar `undefined`. Não use
  // `??` aqui: ele trocaria o `null` do "Máximo" por 6.
  const escolhido = horizonteDaOpcao(opcao);
  const horizonte = escolhido === undefined ? 6 : escolhido;
  const mesFinal = mesFinalDoGrafico(periodo.dataFinal, hojeISO());

  const buscarBarras = useCallback(() => buscarFluxoMensal(mesFinal, horizonte), [mesFinal, horizonte]);
  const buscarRosca = useCallback(
    () => buscarDespesasPorCategoria({ dataInicial: periodo.dataInicial, dataFinal: periodo.dataFinal }),
    [periodo.dataInicial, periodo.dataFinal],
  );
  const barras = useDadosDaTela(buscarBarras);
  const rosca = useDadosDaTela(buscarRosca);

  // Repassa o erro de recarga para o Snackbar da tela e limpa, para não repetir.
  const { feedbackErro: erroBarras, limparFeedbackErro: limparBarras } = barras;
  const { feedbackErro: erroRosca, limparFeedbackErro: limparRosca } = rosca;
  useEffect(() => {
    const mensagem = erroBarras ?? erroRosca;
    if (!mensagem) return;
    onErroAoAtualizar(mensagem);
    limparBarras();
    limparRosca();
  }, [erroBarras, erroRosca, limparBarras, limparRosca, onErroAoAtualizar]);

  function conteudoBarras() {
    if (barras.status === 'carregando') return <Carregando rotulo="Carregando gráfico de entradas e saídas" />;
    if (barras.status === 'erro' || barras.dados === null) return <Erro tela={barras} />;

    const semMovimento = barras.dados.every((mes) => mes.entradas_centavos === 0 && mes.saidas_centavos === 0);
    if (semMovimento) {
      return (
        <EmptyState
          icon="saldo"
          title="Nada pago nesses meses"
          description="As barras mostram as entradas e saídas já pagas. Escolha outro período ou outro número de meses."
        />
      );
    }

    // A chave reinicia o mês escolhido quando a lista de meses muda.
    return <GraficoBarras key={`${mesFinal}-${opcao}`} meses={barras.dados} />;
  }

  function conteudoRosca() {
    if (rosca.status === 'carregando') return <Carregando rotulo="Carregando despesas por categoria" />;
    if (rosca.status === 'erro' || rosca.dados === null) return <Erro tela={rosca} />;

    if (rosca.dados.length === 0) {
      return (
        <EmptyState
          icon="categorias"
          title="Nenhuma despesa paga no período"
          description="A rosca mostra as saídas já pagas, por categoria. Escolha outro período."
        />
      );
    }

    return <GraficoRosca key={`${periodo.dataInicial}-${periodo.dataFinal}`} fatias={rosca.dados} />;
  }

  return (
    <Column gap="lg">
      <Column gap="md">
        <TituloSecao titulo="Entradas e saídas" />
        <Tabs
          options={OPCOES_HORIZONTE}
          value={opcao}
          onChange={setOpcao}
          accessibilityLabel="Meses do gráfico"
          scrollable
        />
        <Card>{conteudoBarras()}</Card>
      </Column>

      <Column gap="md">
        <TituloSecao titulo="Despesas por categoria" />
        <Card>{conteudoRosca()}</Card>
      </Column>
    </Column>
  );
}
