import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';

import { formatarPlaca } from '@/features/veiculos/placa';
import { rotuloStatusVeiculo } from '@/features/veiculos/types';
import { isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { Button, Card, Column, EmptyState, ListItem, Screen, Snackbar, Text, colors, spacing } from '@/ui';

import { buscarVeiculoComHistorico } from './manutencaoRepository';
import type { ManutencaoItem } from './types';

// Situação em texto, nunca só por cor (CLAUDE.md §8).
function subtitulo(manutencao: ManutencaoItem): string {
  const situacao = manutencao.data_conclusao === null ? 'Em aberto' : 'Concluída';
  return `${isoParaDataBR(manutencao.data_manutencao)} · ${situacao}`;
}

export type VeiculoDetalheViewProps = {
  veiculoId: string;
};

// Detalhe do veículo (`/frota/<id>`), aberto pelo "Ver veículo" da lista de manutenções. Mora na
// feature de manutenção porque o conteúdo é o histórico; os dados do veículo são o cabeçalho.
export function VeiculoDetalheView({ veiculoId }: VeiculoDetalheViewProps) {
  const router = useRouter();
  // O mesmo hook das listas: carrega ao abrir, recarrega ao voltar ao foco, tem pull-to-refresh e
  // "Tentar novamente". Outro id é outra consulta, então a tela volta ao carregando.
  const buscar = useCallback(() => buscarVeiculoComHistorico(veiculoId), [veiculoId]);
  const tela = useDadosDaTela(buscar);
  const veiculo = tela.dados;

  if (tela.status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando veículo" />
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

  return (
    // O título "Veículo" fica no header; a placa aparece no cartão porque é dado, não título.
    <Screen
      underHeader
      // Recarga que falha com o histórico já na tela: avisa sem apagar o que está ali.
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <FlatList
        data={veiculo.manutencoes}
        keyExtractor={(manutencao) => manutencao.id}
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
            <Card>
              <Column gap="xs">
                <Text variant="subheading">{formatarPlaca(veiculo.placa)}</Text>
                <Text tone="body">{`${veiculo.marca} ${veiculo.modelo}`}</Text>
                <Text variant="bodySm" weight="medium">
                  {rotuloStatusVeiculo[veiculo.status]}
                </Text>
              </Column>
            </Card>
            <Text variant="caption" tone="body" weight="medium">
              Histórico de manutenções
            </Text>
          </Column>
        }
        ListEmptyComponent={<EmptyState icon="manutencoes" title="Nenhuma manutenção registrada para este veículo." />}
        renderItem={({ item }) => (
          <ListItem
            title={item.descricao}
            subtitle={subtitulo(item)}
            trailing={<Text weight="medium">{formatarMoeda(item.valorCentavos)}</Text>}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    paddingBottom: spacing.sm,
  },
});
