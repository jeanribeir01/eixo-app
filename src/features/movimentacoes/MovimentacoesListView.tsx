import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';

import { isoParaDataBR, nomeDoMes } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { Button, Column, EmptyState, ListItem, Screen, Snackbar, Tabs, Text, colors } from '@/ui';

import { dataDeReferencia, excluirMovimentacao, listarMovimentacoesDoMes } from './movimentacoesRepository';
import { rotuloStatus, type Movimentacao } from './types';

type Status = 'carregando' | 'pronto' | 'erro';
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

export function MovimentacoesListView() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(mesAtual);
  const [status, setStatus] = useState<Status>('carregando');
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // Cada carga ganha um número; só a mais recente pode escrever na tela. Evita que a resposta
  // lenta de outubro apareça depois que o usuário já foi para novembro.
  const ultimoPedido = useRef(0);

  const carregar = useCallback(async () => {
    const pedido = ++ultimoPedido.current;
    setStatus('carregando');
    const resultado = await listarMovimentacoesDoMes(periodo.ano, periodo.mes);
    if (pedido !== ultimoPedido.current) return;

    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setMovimentacoes(resultado.data);
    setStatus('pronto');
  }, [periodo]);

  // Recarrega ao voltar do formulário e quando o mês muda.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

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
    setMovimentacoes((atuais) => atuais.filter((item) => item.id !== movimentacao.id));
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
  const filtradas = movimentacoes.filter(
    (movimentacao) =>
      (filtroTipo === 'todas' || movimentacao.categoria.tipo === filtroTipo) &&
      (filtroStatus === 'todos' || movimentacao.status_pagamento === filtroStatus),
  );
  const comFiltro = filtroTipo !== 'todas' || filtroStatus !== 'todos';

  return (
    <Screen
      underHeader
      overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />}
    >
      <Button label="Nova movimentação" onPress={() => router.push('/movimentacoes/nova')} />

      <Column direction="row" align="center" gap="sm">
        <Button label="‹" variant="ghost" onPress={() => mudarMes(-1)} />
        <Text variant="subheading">{nomeDoMes(periodo.ano, periodo.mes)}</Text>
        <Button label="›" variant="ghost" onPress={() => mudarMes(1)} />
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

      {status === 'carregando' && (
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando movimentações" />
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

      {status === 'pronto' && filtradas.length === 0 && (
        <EmptyState
          title={comFiltro ? 'Nenhuma movimentação com esses filtros' : 'Nenhuma movimentação neste mês'}
          description="Registre uma entrada ou saída para começar."
          actionLabel="Nova movimentação"
          onAction={() => router.push('/movimentacoes/nova')}
        />
      )}

      {status === 'pronto' && filtradas.length > 0 && (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const parcela = item.divida_id !== null;
            const data = isoParaDataBR(dataDeReferencia(item)).slice(0, 5);
            return (
              <View accessibilityLabel={`Movimentação ${item.descricao}`}>
                <ListItem>
                  <Column gap="xs">
                    <Text weight="medium">{item.descricao}</Text>
                    <ValorComSinal movimentacao={item} />
                    <Text variant="bodySm" tone="body">
                      {`${item.categoria.titulo} · ${data} · ${rotuloStatus(item.status_pagamento, item.categoria.tipo)}`}
                    </Text>
                    {parcela && (
                      <Text variant="caption" tone="muted">
                        Parcela de dívida
                      </Text>
                    )}
                    <Column direction="row" gap="sm" wrap>
                      <Button
                        label="Editar"
                        variant="ghost"
                        onPress={() => router.push(`/movimentacoes/${item.id}/editar`)}
                      />
                      {/* Parcela pertence à dívida (US04): some só quando a dívida é excluída. */}
                      {!parcela && <Button label="Excluir" variant="ghost" onPress={() => confirmarExclusao(item)} />}
                    </Column>
                  </Column>
                </ListItem>
              </View>
            );
          }}
        />
      )}

    </Screen>
  );
}
