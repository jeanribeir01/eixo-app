import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { buscarFluxoMensal } from '@/features/dashboard/graficos/queries';
import { hojeISO, mesDeHoje, nomeDoMes, rotuloDoDia, somarMeses, type AnoMes } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Button,
  Card,
  ChipFiltro,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  LinhaDeFiltros,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { dataDeReferencia, excluirMovimentacao, listarMovimentacoesDoMes } from './movimentacoesRepository';
import { rotuloStatus, type Movimentacao } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };
type FiltroTipo = 'todas' | 'Entrada' | 'Saida';
type FiltroStatus = 'todos' | 'Pendente' | 'Pago';

const OPCOES_TIPO = [
  { value: 'todas', label: 'Todas' },
  { value: 'Entrada', label: 'Entradas' },
  { value: 'Saida', label: 'Saídas' },
];

const OPCOES_STATUS = [
  { value: 'todos', label: 'Todos' },
  { value: 'Pendente', label: 'Pendentes' },
  { value: 'Pago', label: 'Pagos' },
];

// O seletor de mês vai de um ano atrás até três meses à frente: parcela e conta a pagar vencem no futuro.
const MESES_ATRAS = 12;
const MESES_A_FRENTE = 3;

function chaveDoMes({ ano, mes }: AnoMes): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function opcoesDeMes(hoje: AnoMes) {
  const opcoes = [];
  for (let delta = MESES_A_FRENTE; delta >= -MESES_ATRAS; delta -= 1) {
    const mes = somarMeses(hoje, delta);
    opcoes.push({ value: chaveDoMes(mes), label: nomeDoMes(mes.ano, mes.mes) });
  }
  return opcoes;
}

// Cor nunca sozinha: o sinal + / − acompanha sempre (DESIGN_CYAN, cores semânticas).
function ValorComSinal({ movimentacao }: { movimentacao: Movimentacao }) {
  const entrada = movimentacao.categoria.tipo === 'Entrada';
  return (
    <Text weight="medium" tone={entrada ? 'success' : 'danger'}>
      {`${entrada ? '+' : '−'} ${formatarMoeda(movimentacao.valorCentavos)}`}
    </Text>
  );
}

// "Combustível · Pendente". A data já está no cabeçalho do dia. A parcela de dívida avisa que é
// parcela: é por isso que ela não tem a opção de excluir (some só quando a dívida é excluída).
function subtitulo(movimentacao: Movimentacao): string {
  const status = rotuloStatus(movimentacao.status_pagamento, movimentacao.categoria.tipo);
  const partes = [movimentacao.categoria.titulo, status];
  if (movimentacao.divida_id !== null) partes.push('Parcela');
  return partes.join(' · ');
}

// A lista é uma só, com o cabeçalho de cada dia entre as linhas: a FlatList continua virtualizando
// e cada linha continua memoizada (EIX-71).
type Linha = { tipo: 'dia'; id: string; rotulo: string } | { tipo: 'movimentacao'; id: string; movimentacao: Movimentacao };

function agruparPorDia(movimentacoes: Movimentacao[], hoje: string): Linha[] {
  // Do dia mais recente para o mais antigo; dentro do dia, a ordem que veio do banco.
  const ordenadas = [...movimentacoes].sort((a, b) => dataDeReferencia(b).localeCompare(dataDeReferencia(a)));
  const linhas: Linha[] = [];
  let diaAtual = '';
  for (const movimentacao of ordenadas) {
    const dia = dataDeReferencia(movimentacao);
    if (dia !== diaAtual) {
      diaAtual = dia;
      linhas.push({ tipo: 'dia', id: `dia-${dia}`, rotulo: rotuloDoDia(dia, hoje) });
    }
    linhas.push({ tipo: 'movimentacao', id: movimentacao.id, movimentacao });
  }
  return linhas;
}

type LinhaProps = {
  movimentacao: Movimentacao;
  onAbrir: (id: string) => void;
  onMaisOpcoes: (movimentacao: Movimentacao) => void;
};

// Linha memoizada (EIX-71): com 200 lançamentos no mês, qualquer mudança na tela (Snackbar, filtro,
// pull-to-refresh) re-renderizava todas as linhas visíveis. Com memo, a linha só re-renderiza quando
// a própria movimentação ou um callback muda; por isso os callbacks do pai são estáveis (useCallback).
const MovimentacaoLinha = memo(function MovimentacaoLinha({ movimentacao, onAbrir, onMaisOpcoes }: LinhaProps) {
  return (
    <ListItem
      title={movimentacao.descricao}
      subtitle={subtitulo(movimentacao)}
      trailing={<ValorComSinal movimentacao={movimentacao} />}
      onPress={() => onAbrir(movimentacao.id)}
      // Parcela pertence à dívida (US04): não tem a opção de excluir.
      control={
        movimentacao.divida_id === null ? (
          <Button
            variant="icon"
            icon="maisOpcoes"
            label={`Mais opções: ${movimentacao.descricao}`}
            onPress={() => onMaisOpcoes(movimentacao)}
          />
        ) : undefined
      }
    />
  );
});

// Fora do componente: a mesma função em todo render, sem precisar de useCallback.
function chaveDaLinha(linha: Linha): string {
  return linha.id;
}

// Resumo do mês no topo: o que já foi pago, entradas menos saídas. As duas somas vêm prontas do banco
// (`fluxo_caixa_mensal`, RNF06); aqui só a diferença entre elas.
function ResumoDoMes({ entradas, saidas, nomeMes }: { entradas: number; saidas: number; nomeMes: string }) {
  const saldo = entradas - saidas;
  return (
    <Card>
      <Text variant="bodySm" tone="body">
        {`Pago em ${nomeMes.toLowerCase()}`}
      </Text>
      <Text variant="heading" weight="semibold">
        {`${saldo < 0 ? '−' : '+'} ${formatarMoeda(Math.abs(saldo))}`}
      </Text>
      <Text variant="bodySm" tone="body">
        {`+ ${formatarMoeda(entradas)} em entradas · − ${formatarMoeda(saidas)} em saídas`}
      </Text>
    </Card>
  );
}

export function MovimentacoesListView() {
  const router = useRouter();
  const [hoje] = useState(mesDeHoje);
  const [periodo, setPeriodo] = useState(hoje);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const coluna = useScreenColumn();
  const opcoesMes = useMemo(() => opcoesDeMes(hoje), [hoje]);

  // Cada mês é uma consulta: trocar de mês volta ao skeleton em vez de mostrar o mês anterior.
  const buscar = useCallback(() => listarMovimentacoesDoMes(periodo.ano, periodo.mes), [periodo]);
  const tela = useDadosDaTela(buscar);
  const { atualizarDados } = tela;

  // O resumo é uma consulta à parte: se falhar, a lista continua na tela, só sem o cartão.
  const buscarResumo = useCallback(
    () => buscarFluxoMensal(`${chaveDoMes(periodo)}-01`, 3),
    [periodo],
  );
  const resumo = useDadosDaTela(buscarResumo);
  const mesDoResumo = resumo.dados?.find((item) => item.mes === chaveDoMes(periodo));

  const excluir = useCallback(
    async (movimentacao: Movimentacao) => {
      const resultado = await excluirMovimentacao(movimentacao.id);
      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }
      atualizarDados((atuais) => atuais.filter((item) => item.id !== movimentacao.id));
      setFeedback({ mensagem: 'Movimentação excluída.', tone: 'success' });
    },
    [atualizarDados],
  );

  // Delete é físico e sem volta: confirmação no diálogo nativo do sistema.
  const confirmarExclusao = useCallback(
    (movimentacao: Movimentacao) => {
      Alert.alert('Excluir movimentação?', movimentacao.descricao, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => excluir(movimentacao) },
      ]);
    },
    [excluir],
  );

  const abrir = useCallback((id: string) => router.push(`/movimentacoes/${id}/editar`), [router]);

  const renderLinha = useCallback(
    ({ item }: ListRenderItemInfo<Linha>) =>
      item.tipo === 'dia' ? (
        <View style={styles.dia}>
          <Text weight="semibold" accessibilityRole="header">
            {item.rotulo}
          </Text>
        </View>
      ) : (
        <MovimentacaoLinha movimentacao={item.movimentacao} onAbrir={abrir} onMaisOpcoes={confirmarExclusao} />
      ),
    [abrir, confirmarExclusao],
  );

  // Um mês cabe na memória: tipo e status filtram aqui, sem nova chamada ao banco. O useMemo mantém o
  // mesmo array enquanto dados e filtros não mudam (um Snackbar aparecendo não recria a lista).
  const linhas = useMemo(() => {
    const filtradas = (tela.dados ?? []).filter(
      (movimentacao) =>
        (filtroTipo === 'todas' || movimentacao.categoria.tipo === filtroTipo) &&
        (filtroStatus === 'todos' || movimentacao.status_pagamento === filtroStatus),
    );
    return agruparPorDia(filtradas, hojeISO());
  }, [tela.dados, filtroTipo, filtroStatus]);
  const comFiltro = filtroTipo !== 'todas' || filtroStatus !== 'todos';

  const puxarParaAtualizar = useCallback(async () => {
    await Promise.all([tela.puxarParaAtualizar(), resumo.puxarParaAtualizar()]);
  }, [tela, resumo]);

  // Um Snackbar só: o retorno da ação vem antes do aviso de recarga que falhou.
  const snackbar = feedback ?? (tela.feedbackErro ? { mensagem: tela.feedbackErro, tone: 'error' as const } : null);

  return (
    <Screen
      underHeader
      list
      overlay={
        snackbar && (
          <Snackbar
            message={snackbar.mensagem}
            tone={snackbar.tone}
            onDismiss={() => (feedback ? setFeedback(null) : tela.limparFeedbackErro())}
          />
        )
      }
      // O FAB é a ação de criar e o único cyan da tela (DESIGN_CYAN §7).
      fab={<FAB label="Nova movimentação" onPress={() => router.push('/movimentacoes/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        {/* Uma linha de chips no lugar das setas de mês e das duas fileiras de abas (referência
            Nubank do redesign). */}
        <LinhaDeFiltros accessibilityLabel="Filtros">
          <ChipFiltro
            label="Mês"
            value={chaveDoMes(periodo)}
            options={opcoesMes}
            onChange={(valor) => {
              const [ano, mes] = valor.split('-').map(Number);
              setPeriodo({ ano, mes });
            }}
          />
          <ChipFiltro
            label="Tipo"
            value={filtroTipo}
            valorPadrao="todas"
            options={OPCOES_TIPO}
            onChange={(valor) => setFiltroTipo(valor as FiltroTipo)}
          />
          <ChipFiltro
            label="Status"
            value={filtroStatus}
            valorPadrao="todos"
            options={OPCOES_STATUS}
            onChange={(valor) => setFiltroStatus(valor as FiltroStatus)}
          />
        </LinhaDeFiltros>

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando movimentações" />
            <Skeleton height="xxl" />
            <Skeleton height="xxl" />
          </Column>
        )}

        {tela.status === 'erro' && (
          <EmptyState
            title="Não foi possível carregar"
            description={tela.erro ?? undefined}
            actionLabel="Tentar novamente"
            onAction={tela.recarregar}
          />
        )}
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <List
          data={linhas}
          keyExtractor={chaveDaLinha}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.espacoDoFab]}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={puxarParaAtualizar}
              colors={[colors.accentStrong]}
              tintColor={colors.accentStrong}
            />
          }
          ListHeaderComponent={
            mesDoResumo ? (
              <ResumoDoMes
                entradas={mesDoResumo.entradas_centavos}
                saidas={mesDoResumo.saidas_centavos}
                nomeMes={nomeDoMes(periodo.ano, periodo.mes).split(' ')[0]}
              />
            ) : null
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até num mês sem lançamento. Sem ação
          // aqui, porque o FAB "Nova movimentação" já está na tela.
          ListEmptyComponent={
            <EmptyState
              title={comFiltro ? 'Nenhuma movimentação com esses filtros' : 'Nenhuma movimentação neste mês'}
              description="Registre uma entrada ou saída para começar."
            />
          }
          renderItem={renderLinha}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
  // Respiro acima do dia separa os grupos; o de baixo é menor, o dia "pertence" às linhas dele.
  dia: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
});
