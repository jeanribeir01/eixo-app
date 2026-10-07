import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { rotuloStatus } from '@/features/movimentacoes/types';
import { isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { Card, Column, EmptyState, ListItem, Screen, Text, colors, spacing } from '@/ui';

import { buscarDivida } from '../dividasRepository';
import type { DividaDetalhe, Parcela } from '../types';

type Status = 'carregando' | 'pronto' | 'erro';

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Column gap="xs">
      <Text variant="caption" tone="body">
        {rotulo}
      </Text>
      <Text weight="medium">{valor}</Text>
    </Column>
  );
}

// Parcela é sempre uma saída do caixa: "Pago", nunca "Recebido". Status em texto, sem cor sozinha.
function rotuloParcela(parcela: Parcela): string {
  return `Vencimento ${isoParaDataBR(parcela.dataVencimento)} · ${rotuloStatus(parcela.status, 'Saida')}`;
}

export function DividaDetalheView({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>('carregando');
  const [divida, setDivida] = useState<DividaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Mudar a tentativa dispara a carga de novo ("Tentar novamente").
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;

    buscarDivida(id).then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        setStatus('erro');
        return;
      }
      setDivida(resultado.data);
      setStatus('pronto');
    });

    return () => {
      cancelado = true;
    };
  }, [id, tentativa]);

  function tentarDeNovo() {
    setStatus('carregando');
    setTentativa((atual) => atual + 1);
  }

  if (status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando dívida" />
      </Screen>
    );
  }

  if (status === 'erro' || !divida) {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar"
          description={erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tentarDeNovo}
        />
      </Screen>
    );
  }

  return (
    // O título "Dívida" fica no header; a descrição aparece no cartão porque é dado, não título.
    <Screen underHeader>
      <FlatList
        data={divida.parcelas}
        keyExtractor={(parcela) => parcela.id}
        ListHeaderComponentStyle={styles.cabecalho}
        ListHeaderComponent={
          <Column gap="lg">
            <Card variant="feature">
              <Column gap="xs">
                <Text variant="caption" tone="body">
                  {divida.categoria.titulo}
                </Text>
                <Text variant="subheading">{divida.descricao}</Text>
              </Column>
              <Resumo rotulo="Soma total" valor={formatarMoeda(divida.somaTotalCentavos)} />
              <Column direction="row" gap="lg" wrap>
                <Resumo rotulo="Parcelas pagas" valor={`${divida.parcelasPagas} de ${divida.quantidadeParcelas}`} />
                <Resumo rotulo="Valor da parcela" valor={formatarMoeda(divida.valorParcelaCentavos)} />
                {divida.valorQuitacaoCentavos !== null && (
                  <Resumo rotulo="Quitação antecipada" valor={formatarMoeda(divida.valorQuitacaoCentavos)} />
                )}
              </Column>
            </Card>
            <Text variant="caption" tone="body" weight="medium">
              Parcelas geradas
            </Text>
          </Column>
        }
        renderItem={({ item }) => (
          <ListItem
            title={`Parcela ${item.numero}`}
            subtitle={rotuloParcela(item)}
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
