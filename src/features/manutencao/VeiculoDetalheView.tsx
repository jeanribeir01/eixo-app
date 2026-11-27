import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { formatarPlaca } from '@/features/veiculos/placa';
import { rotuloStatusVeiculo } from '@/features/veiculos/types';
import { dataLocalISO, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  ListItem,
  Screen,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { buscarVeiculoComHistorico } from './manutencaoRepository';
import type { ManutencaoItem } from './types';

// Cabeçalhos e manutenções numa FlatList só, como nas outras listas do redesign.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'manutencao'; id: string; manutencao: ManutencaoItem };

// Em aberto primeiro (o veículo está parado por causa delas), depois as concluídas, na ordem recebida.
function agruparManutencoes(manutencoes: ManutencaoItem[]): Linha[] {
  const abertas = manutencoes.filter((manutencao) => manutencao.data_conclusao === null);
  const concluidas = manutencoes.filter((manutencao) => manutencao.data_conclusao !== null);
  const linhas: Linha[] = [];
  if (abertas.length > 0) {
    linhas.push({ tipo: 'grupo', id: 'grupo-abertas', rotulo: `Em aberto · ${abertas.length}` });
    for (const manutencao of abertas) linhas.push({ tipo: 'manutencao', id: manutencao.id, manutencao });
  }
  if (concluidas.length > 0) {
    linhas.push({ tipo: 'grupo', id: 'grupo-concluidas', rotulo: `Concluídas · ${concluidas.length}` });
    for (const manutencao of concluidas) linhas.push({ tipo: 'manutencao', id: manutencao.id, manutencao });
  }
  return linhas;
}

// Situação em texto, nunca só por cor (CLAUDE.md §8). A conclusão é um instante (timestamptz): a data
// mostrada é a do fuso do aparelho.
function subtitulo(manutencao: ManutencaoItem): string {
  const data = isoParaDataBR(manutencao.data_manutencao);
  if (manutencao.data_conclusao === null) return `${data} · Em aberto`;
  // Só dia e mês na conclusão: o ano é o mesmo da abertura quase sempre, e a linha cabe sem cortar.
  return `${data} · Concluída em ${isoParaDataBR(dataLocalISO(new Date(manutencao.data_conclusao))).slice(0, 5)}`;
}

function renderLinha({ item }: ListRenderItemInfo<Linha>) {
  if (item.tipo === 'grupo') {
    return (
      <View style={styles.grupo}>
        <Text weight="semibold" accessibilityRole="header">
          {item.rotulo}
        </Text>
      </View>
    );
  }
  const { manutencao } = item;
  return (
    <ListItem
      icon="manutencoes"
      // Em aberto, a chave fica no tom de alerta: o veículo está parado por ela. O texto diz o mesmo.
      iconTone={manutencao.data_conclusao === null ? 'warning' : 'body'}
      title={manutencao.descricao}
      subtitle={subtitulo(manutencao)}
      trailing={<Text weight="medium">{formatarMoeda(manutencao.valorCentavos)}</Text>}
    />
  );
}

export type VeiculoDetalheViewProps = {
  veiculoId: string;
};

// Detalhe do veículo (`/frota/<id>`), aberto pela lista de Veículos, pela aba Frota, pelo Detalhe da viagem,
// pelo "Ver veículo" da lista de manutenções e pelo Ranking. Mora na feature de manutenção porque o
// conteúdo é o histórico; os dados do veículo são o cartão de destaque.
export function VeiculoDetalheView({ veiculoId }: VeiculoDetalheViewProps) {
  const router = useRouter();
  // O mesmo hook das listas: carrega ao abrir, recarrega ao voltar ao foco, tem pull-to-refresh e
  // "Tentar novamente". Outro id é outra consulta, então a tela volta ao carregando.
  const buscar = useCallback(() => buscarVeiculoComHistorico(veiculoId), [veiculoId]);
  const tela = useDadosDaTela(buscar);
  const veiculo = tela.dados;
  const coluna = useScreenColumn();
  const linhas = useMemo(() => agruparManutencoes(veiculo?.manutencoes ?? []), [veiculo]);

  if (tela.status === 'carregando') {
    return (
      <Screen underHeader>
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando veículo" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
      </Screen>
    );
  }

  if (tela.status === 'erro' || !veiculo) {
    return (
      // As duas saídas: falha de rede se resolve tentando de novo; veículo que não existe (ou que o
      // RLS esconde), só voltando.
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar o veículo"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const total = veiculo.manutencoes.length;
  const abertas = veiculo.manutencoes.filter((manutencao) => manutencao.data_conclusao === null).length;
  const resumo =
    total === 0
      ? 'Nenhuma manutenção registrada'
      : `${total} ${total === 1 ? 'manutenção registrada' : 'manutenções registradas'}${abertas > 0 ? ` · ${abertas} em aberto` : ''}`;

  return (
    // O título "Veículo" fica no header; a placa aparece no cartão porque é dado, não título.
    <Screen
      underHeader
      // No tablet a rolagem usa a largura toda e o cartão e o histórico ficam na coluna (EIX-94).
      list
      // Recarga que falha com o histórico já na tela: avisa sem apagar o que está ali.
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <FlatList
        data={linhas}
        keyExtractor={(linha) => linha.id}
        contentContainerStyle={coluna}
        refreshControl={
          <RefreshControl
            refreshing={tela.atualizando}
            onRefresh={tela.puxarParaAtualizar}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        ListHeaderComponentStyle={styles.cabecalho}
        ListHeaderComponent={
          <Column gap="lg">
            <Card variant="feature">
              {/* O status fica dentro do cartão, ao lado do rótulo, e não solto acima dele. */}
              <View style={styles.topo}>
                <Text variant="bodySm" tone="body">
                  Veículo
                </Text>
                <Badge label={rotuloStatusVeiculo[veiculo.status]} tone="neutral" />
              </View>
              <Column gap="xs">
                <Text variant="display" weight="semibold">
                  {formatarPlaca(veiculo.placa)}
                </Text>
                <Text tone="body">{`${veiculo.marca} ${veiculo.modelo}`}</Text>
              </Column>
              <View style={styles.divisor} />
              <Text variant="bodySm" tone="body">
                {resumo}
              </Text>
            </Card>
            <Text variant="subheading" weight="semibold" accessibilityRole="header">
              Histórico de manutenções
            </Text>
          </Column>
        }
        ListEmptyComponent={<EmptyState icon="manutencoes" title="Nenhuma manutenção registrada para este veículo." />}
        renderItem={renderLinha}
        ListFooterComponentStyle={styles.rodape}
        ListFooterComponent={
          <Button label="Editar veículo" variant="ghost" onPress={() => router.push(`/frota/${veiculo.id}/editar`)} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    paddingBottom: spacing.sm,
  },
  grupo: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  divisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  rodape: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
});
