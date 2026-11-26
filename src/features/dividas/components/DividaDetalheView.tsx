import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { hojeISO, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { Card, Column, EmptyState, ListItem, Screen, Skeleton, Text, colors, spacing, useScreenColumn } from '@/ui';

import { buscarDivida } from '../dividasRepository';
import type { DividaDetalhe, Parcela } from '../types';

type Status = 'carregando' | 'pronto' | 'erro';

// Cabeçalhos e parcelas numa FlatList só: um financiamento de 48 parcelas continua virtualizado.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'parcela'; id: string; parcela: Parcela };

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

// Em aberto primeiro (o que ainda vai sair do caixa), depois as pagas. As duas em ordem de vencimento.
function agruparParcelas(parcelas: Parcela[]): Linha[] {
  const emAberto = parcelas.filter((parcela) => parcela.status === 'Pendente');
  const pagas = parcelas.filter((parcela) => parcela.status === 'Pago');
  const linhas: Linha[] = [];
  if (emAberto.length > 0) {
    linhas.push({ tipo: 'grupo', id: 'grupo-em-aberto', rotulo: `Em aberto · ${emAberto.length}` });
    for (const parcela of emAberto) linhas.push({ tipo: 'parcela', id: parcela.id, parcela });
  }
  if (pagas.length > 0) {
    linhas.push({ tipo: 'grupo', id: 'grupo-pagas', rotulo: `Pagas · ${pagas.length}` });
    for (const parcela of pagas) linhas.push({ tipo: 'parcela', id: parcela.id, parcela });
  }
  return linhas;
}

// Parcela é sempre uma saída do caixa: "Paga", nunca "Recebida". O status vai em texto, nunca só na cor.
function subtituloDaParcela(parcela: Parcela, hoje: string): string {
  if (parcela.status === 'Pago') {
    return parcela.dataPagamento
      ? `Paga em ${isoParaDataBR(parcela.dataPagamento)}`
      : `Paga · vencimento ${isoParaDataBR(parcela.dataVencimento)}`;
  }
  return parcela.dataVencimento < hoje
    ? `Venceu em ${isoParaDataBR(parcela.dataVencimento)} · em atraso`
    : `Vence em ${isoParaDataBR(parcela.dataVencimento)}`;
}

export function DividaDetalheView({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>('carregando');
  const [divida, setDivida] = useState<DividaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Mudar a tentativa dispara a carga de novo ("Tentar novamente").
  const [tentativa, setTentativa] = useState(0);
  const coluna = useScreenColumn();

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

  const linhas = useMemo(() => agruparParcelas(divida?.parcelas ?? []), [divida]);

  function tentarDeNovo() {
    setStatus('carregando');
    setTentativa((atual) => atual + 1);
  }

  if (status === 'carregando') {
    return (
      <Screen underHeader>
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando dívida" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
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

  const hoje = hojeISO();
  const emAberto = divida.quantidadeParcelas - divida.parcelasPagas;
  const total = divida.quantidadeParcelas;
  // As parcelas chegam em ordem de vencimento: a primeira pendente é a próxima a pagar.
  const proximaId = divida.parcelas.find((parcela) => parcela.status === 'Pendente')?.id;

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
    const { parcela } = item;
    const paga = parcela.status === 'Pago';
    const atrasada = !paga && parcela.dataVencimento < hoje;
    return (
      <ListItem
        // Ícone e texto dizem o mesmo estado: relógio para o que vai vencer, alerta para o atrasado.
        icon={paga ? 'sucesso' : atrasada ? 'alerta' : 'aguardando'}
        iconTone={atrasada ? 'warning' : 'body'}
        title={`Parcela ${parcela.numero} de ${total}${parcela.id === proximaId ? ' · próxima' : ''}`}
        subtitle={subtituloDaParcela(parcela, hoje)}
        trailing={<Text weight="medium">{formatarMoeda(parcela.valorCentavos)}</Text>}
      />
    );
  }

  return (
    // O título "Dívida" fica no header; a descrição aparece no cartão porque é dado, não título.
    // `list`: no tablet a rolagem usa a largura toda e o cartão e as parcelas ficam na coluna (EIX-94).
    <Screen underHeader list>
      <FlatList
        data={linhas}
        keyExtractor={(linha) => linha.id}
        contentContainerStyle={coluna}
        ListHeaderComponentStyle={styles.cabecalho}
        ListHeaderComponent={
          <Card variant="feature">
            <Column gap="xs">
              <Text variant="bodySm" tone="body">
                {divida.categoria.titulo}
              </Text>
              <Text variant="subheading" weight="semibold">
                {divida.descricao}
              </Text>
            </Column>
            <Column gap="xs">
              <Text variant="caption" tone="body">
                {emAberto > 0 ? 'Saldo pendente' : 'Dívida quitada'}
              </Text>
              <Text variant="display" weight="semibold">
                {formatarMoeda(divida.saldoPendenteCentavos)}
              </Text>
              <Text tone="body">
                {`${emAberto} de ${total} ${total === 1 ? 'parcela' : 'parcelas'} em aberto · ${formatarMoeda(divida.valorParcelaCentavos)} por parcela`}
              </Text>
            </Column>
            <View style={styles.divisor} />
            <Column direction="row" gap="lg" wrap>
              <Resumo rotulo="Soma total" valor={formatarMoeda(divida.somaTotalCentavos)} />
              <Resumo rotulo="Parcelas pagas" valor={`${divida.parcelasPagas} de ${total}`} />
              {divida.valorQuitacaoCentavos !== null && (
                <Resumo rotulo="Quitação antecipada" valor={formatarMoeda(divida.valorQuitacaoCentavos)} />
              )}
            </Column>
          </Card>
        }
        renderItem={renderLinha}
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
  divisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
