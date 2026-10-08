import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, FlatList, RefreshControl, StyleSheet } from 'react-native';

import { isoParaDataBR, nomeDoMes } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Button,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  ListItem,
  Screen,
  Skeleton,
  Snackbar,
  Tabs,
  Text,
  colors,
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

function mesAtual() {
  const hoje = new Date();
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
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

// "Combustível · 12/10 · Pendente". A parcela de dívida avisa que é parcela: é por isso que ela não
// tem a opção de excluir (some só quando a dívida é excluída).
function subtitulo(movimentacao: Movimentacao): string {
  const data = isoParaDataBR(dataDeReferencia(movimentacao)).slice(0, 5);
  const status = rotuloStatus(movimentacao.status_pagamento, movimentacao.categoria.tipo);
  const partes = [movimentacao.categoria.titulo, data, status];
  if (movimentacao.divida_id !== null) partes.push('Parcela');
  return partes.join(' · ');
}

export function MovimentacoesListView() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(mesAtual);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Cada mês é uma consulta: trocar de mês volta ao skeleton em vez de mostrar o mês anterior.
  const buscar = useCallback(() => listarMovimentacoesDoMes(periodo.ano, periodo.mes), [periodo]);
  const tela = useDadosDaTela(buscar);

  function mudarMes(delta: number) {
    setPeriodo(({ ano, mes }) => {
      const data = new Date(ano, mes - 1 + delta, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() + 1 };
    });
  }

  async function excluir(movimentacao: Movimentacao) {
    const resultado = await excluirMovimentacao(movimentacao.id);
    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }
    tela.atualizarDados((atuais) => atuais.filter((item) => item.id !== movimentacao.id));
    setFeedback({ mensagem: 'Movimentação excluída.', tone: 'success' });
  }

  // Delete é físico e sem volta: confirmação no diálogo nativo do sistema.
  function confirmarExclusao(movimentacao: Movimentacao) {
    Alert.alert('Excluir movimentação?', movimentacao.descricao, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => excluir(movimentacao) },
    ]);
  }

  // Um mês cabe na memória: tipo e status filtram aqui, sem nova chamada ao banco.
  const filtradas = (tela.dados ?? []).filter(
    (movimentacao) =>
      (filtroTipo === 'todas' || movimentacao.categoria.tipo === filtroTipo) &&
      (filtroStatus === 'todos' || movimentacao.status_pagamento === filtroStatus),
  );
  const comFiltro = filtroTipo !== 'todas' || filtroStatus !== 'todos';

  // Um Snackbar só: o retorno da ação vem antes do aviso de recarga que falhou.
  const snackbar = feedback ?? (tela.feedbackErro ? { mensagem: tela.feedbackErro, tone: 'error' as const } : null);

  return (
    <Screen
      underHeader
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
      <Column direction="row" align="center" gap="sm">
        <Button variant="icon" icon="voltarMes" label="Mês anterior" onPress={() => mudarMes(-1)} />
        <Text variant="subheading">{nomeDoMes(periodo.ano, periodo.mes)}</Text>
        <Button variant="icon" icon="avancarMes" label="Próximo mês" onPress={() => mudarMes(1)} />
      </Column>

      <Tabs
        accessibilityLabel="Filtrar por tipo"
        options={OPCOES_TIPO}
        value={filtroTipo}
        onChange={(valor) => setFiltroTipo(valor as FiltroTipo)}
      />
      <Tabs
        accessibilityLabel="Filtrar por status"
        options={OPCOES_STATUS}
        value={filtroStatus}
        onChange={(valor) => setFiltroStatus(valor as FiltroStatus)}
      />

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

      {tela.status === 'pronto' && (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          contentContainerStyle={styles.espacoDoFab}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até num mês sem lançamento. Sem ação
          // aqui, porque o FAB "Nova movimentação" já está na tela.
          ListEmptyComponent={
            <EmptyState
              title={comFiltro ? 'Nenhuma movimentação com esses filtros' : 'Nenhuma movimentação neste mês'}
              description="Registre uma entrada ou saída para começar."
            />
          }
          renderItem={({ item }) => (
            <ListItem
              title={item.descricao}
              subtitle={subtitulo(item)}
              trailing={<ValorComSinal movimentacao={item} />}
              onPress={() => router.push(`/movimentacoes/${item.id}/editar`)}
              // Parcela pertence à dívida (US04): não tem a opção de excluir.
              control={
                item.divida_id === null ? (
                  <Button
                    variant="icon"
                    icon="maisOpcoes"
                    label={`Mais opções: ${item.descricao}`}
                    onPress={() => confirmarExclusao(item)}
                  />
                ) : undefined
              }
            />
          )}
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
});
