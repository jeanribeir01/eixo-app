import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { hojeISO, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useCargaUnica } from '@/lib/useCargaUnica';
import {
  Aviso,
  Button,
  Card,
  Column,
  EmptyState,
  FolhaDeConfirmacao,
  ListItem,
  Screen,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { buscarDivida, excluirDivida } from '../dividasRepository';
import type { DividaDetalhe, Parcela } from '../types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function plural(quantidade: number, singular: string, pluralizado: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : pluralizado}`;
}

// O que a exclusão faz, dito antes de a pessoa confirmar (DIV-05): as pendentes saem do caixa, as pagas ficam.
function consequenciaDaExclusao(emAberto: number, pagas: number): string {
  if (emAberto === 0) return 'Nenhuma parcela em aberto: a dívida só sai da lista, e as pagas continuam no caixa.';
  const removidas = `${plural(emAberto, 'parcela em aberto sai', 'parcelas em aberto saem')} do caixa.`;
  if (pagas === 0) return removidas;
  return `${removidas} ${pagas === 1 ? 'A paga continua' : `As ${pagas} pagas continuam`} no histórico.`;
}

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
  const router = useRouter();
  const [divida, setDivida] = useState<DividaDetalhe | null>(null);
  const coluna = useScreenColumn();
  const [excluindo, setExcluindo] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // O estado sozinho não barra um segundo toque em "Excluir" antes do próximo render. O ref é a guarda
  // síncrona (mesmo padrão de Finalizar viagem).
  const excluindoRef = useRef(false);
  const [confirmando, setConfirmando] = useState(false);

  // Carga única (useCargaUnica): sem internet a tela diz isso na hora e tenta de novo sozinha quando a
  // conexão volta.
  const buscar = useCallback(() => buscarDivida(id), [id]);
  const { status, erro, tentarDeNovo } = useCargaUnica(buscar, setDivida);

  const linhas = useMemo(() => agruparParcelas(divida?.parcelas ?? []), [divida]);

  async function excluir() {
    if (excluindoRef.current) return;
    excluindoRef.current = true;
    setExcluindo(true);

    const resultado = await excluirDivida(id);
    if (!resultado.ok) {
      excluindoRef.current = false;
      setExcluindo(false);
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    // O botão segue em loading até o Snackbar fechar e a tela voltar para a lista, que recarrega no foco.
    const { parcelasRemovidas, parcelasPreservadas } = resultado.data;
    const detalhe =
      parcelasRemovidas === 0
        ? 'Nenhuma parcela em aberto foi removida.'
        : `${plural(parcelasRemovidas, 'parcela em aberto removida', 'parcelas em aberto removidas')}.`;
    const preservadas =
      parcelasPreservadas > 0 ? ` ${plural(parcelasPreservadas, 'paga continua', 'pagas continuam')} no caixa.` : '';
    setFeedback({ mensagem: `Dívida excluída. ${detalhe}${preservadas}`, tone: 'success' });
  }


  function dispensarFeedback() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
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
    <Screen
      underHeader
      list
      overlay={
        feedback ? (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={dispensarFeedback} />
        ) : undefined
      }
    >
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
        ListFooterComponentStyle={styles.rodape}
        ListFooterComponent={
          <Column gap="md">
            <Aviso tom="info" icone="versao" titulo="Ao excluir esta dívida">
              {consequenciaDaExclusao(emAberto, divida.parcelasPagas)}
            </Aviso>
            <Button
              label="Excluir dívida"
              variant="danger"
              loading={excluindo}
              disabled={excluindo}
              onPress={() => setConfirmando(true)}
            />
          </Column>
        }
      />

      {/* Delete é sem volta para as pendentes: a folha repete o que vai acontecer antes do "Excluir". */}
      <FolhaDeConfirmacao
        visivel={confirmando}
        titulo="Excluir dívida?"
        mensagem={`${divida.descricao}. ${consequenciaDaExclusao(emAberto, divida.parcelasPagas)}`}
        rotuloConfirmar="Excluir"
        tom="danger"
        onConfirmar={() => {
          setConfirmando(false);
          void excluir();
        }}
        onCancelar={() => setConfirmando(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    paddingBottom: spacing.sm,
  },
  rodape: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
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
