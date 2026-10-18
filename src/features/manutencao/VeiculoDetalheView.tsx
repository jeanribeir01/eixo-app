import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { formatarPlaca } from '@/features/veiculos/placa';
import { rotuloStatusVeiculo } from '@/features/veiculos/types';
import { isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { Card, Column, EmptyState, ListItem, Screen, Text, colors, spacing } from '@/ui';

import { buscarVeiculoComHistorico } from './manutencaoRepository';
import type { ManutencaoItem, VeiculoComHistorico } from './types';

type Status = 'carregando' | 'pronto' | 'erro';

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
  const [status, setStatus] = useState<Status>('carregando');
  const [veiculo, setVeiculo] = useState<VeiculoComHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const resultado = await buscarVeiculoComHistorico(veiculoId);
      if (cancelado) return;

      if (!resultado.ok) {
        setErro(resultado.mensagem);
        setStatus('erro');
        return;
      }
      setVeiculo(resultado.data);
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [veiculoId]);

  if (status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando veículo" />
      </Screen>
    );
  }

  if (status === 'erro' || !veiculo) {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar o veículo"
          description={erro ?? undefined}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    // O título "Veículo" fica no header; a placa aparece no cartão porque é dado, não título.
    <Screen underHeader>
      <FlatList
        data={veiculo.manutencoes}
        keyExtractor={(manutencao) => manutencao.id}
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
