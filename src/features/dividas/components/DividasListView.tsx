import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { hojeISO, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  AvisoSemInternet,
  Badge,
  Card,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
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

import { listarDividas } from '../dividasRepository';
import type { Divida } from '../types';

// "3 de 12 parcelas pagas": o progresso da dívida numa linha só, abaixo da descrição.
function rotuloParcelasPagas(divida: Pick<Divida, 'parcelasPagas' | 'quantidadeParcelas'>): string {
  return `${divida.parcelasPagas} de ${divida.quantidadeParcelas} parcelas pagas`;
}

// "15/03": dia e mês bastam na lista; o ano aparece no detalhe.
function diaEMes(iso: string): string {
  return isoParaDataBR(iso).slice(0, 5);
}

// "Vence 15/03" ou, se já passou e não foi paga, "Venceu 15/03".
function rotuloVencimento(dataVencimento: string, hoje: string): string {
  return `${dataVencimento < hoje ? 'Venceu' : 'Vence'} ${diaEMes(dataVencimento)}`;
}

// "2 de 48 pagas · vence 15/03": curto para caber numa linha ao lado do valor.
function subtitulo(divida: Divida, hoje: string): string {
  const pagas = `${divida.parcelasPagas} de ${divida.quantidadeParcelas} pagas`;
  if (!divida.proximaParcela) return `Quitada · ${pagas}`;
  return `${pagas} · ${rotuloVencimento(divida.proximaParcela.dataVencimento, hoje).toLowerCase()}`;
}

// O que ainda falta pagar, somando as dívidas ativas, e a parcela que vence primeiro entre todas. As somas
// partem das parcelas que a consulta já trouxe (uma linha por dívida), sem nova ida ao banco.
function resumoDasDividas(dividas: Divida[]) {
  const saldoCentavos = dividas.reduce((soma, divida) => soma + divida.saldoPendenteCentavos, 0);
  const parcelasEmAberto = dividas.reduce(
    (soma, divida) => soma + (divida.quantidadeParcelas - divida.parcelasPagas),
    0,
  );
  const proxima = dividas.reduce<Divida | undefined>((escolhida, divida) => {
    if (!divida.proximaParcela) return escolhida;
    if (!escolhida?.proximaParcela) return divida;
    return divida.proximaParcela.dataVencimento < escolhida.proximaParcela.dataVencimento ? divida : escolhida;
  }, undefined);
  return { saldoCentavos, parcelasEmAberto, proxima };
}

// O cartão de destaque da tela: quanto falta pagar e o que vence primeiro.
function ResumoDasDividas({ dividas }: { dividas: Divida[] }) {
  const { saldoCentavos, parcelasEmAberto, proxima } = resumoDasDividas(dividas);
  const parcela = proxima?.proximaParcela;
  const hoje = hojeISO();
  const atrasada = parcela ? parcela.dataVencimento < hoje : false;

  return (
    <Card variant="feature">
      <Text variant="bodySm" tone="body">
        Saldo pendente
      </Text>
      <Column gap="xs">
        <Text variant="display" weight="semibold">
          {formatarMoeda(saldoCentavos)}
        </Text>
        <Text tone="body">
          {`${parcelasEmAberto} ${parcelasEmAberto === 1 ? 'parcela em aberto' : 'parcelas em aberto'} em ${dividas.length} ${dividas.length === 1 ? 'dívida' : 'dívidas'}`}
        </Text>
      </Column>
      {proxima && parcela && (
        <>
          <View style={styles.divisor} />
          <Column gap="xs">
            <View style={styles.linhaTopo}>
              <Text weight="medium">Próximo vencimento</Text>
              {atrasada && <Badge label="Em atraso" tone="warning" />}
            </View>
            <Text variant="bodySm" tone="body" numberOfLines={1}>
              {proxima.descricao}
            </Text>
            <Text variant="bodySm" tone="body">
              {`${rotuloVencimento(parcela.dataVencimento, hoje)} · ${formatarMoeda(parcela.valorCentavos)}`}
            </Text>
          </Column>
        </>
      )}
    </Card>
  );
}

export function DividasListView() {
  const router = useRouter();
  const coluna = useScreenColumn();
  const hoje = hojeISO();
  // A mesma carga das outras listas (useDadosDaTela): recarrega ao voltar do cadastro sem piscar o
  // skeleton, e sem internet avisa em vez de ficar carregando.
  const tela = useDadosDaTela(listarDividas);
  const { status, erro } = tela;
  const dividas = tela.dados ?? [];

  return (
    // O FAB é a ação de criar e o único cyan da tela (DESIGN_CYAN §7).
    <Screen
      underHeader
      list
      fab={<FAB label="Nova dívida" onPress={() => router.push('/dividas/nova')} />}
      // Recarga que falha com a lista já na tela: avisa sem apagar o que está ali.
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        {tela.semInternet && status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

        {status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando dívidas" />
            <Skeleton height="xxl" />
            <Skeleton height="xxl" />
          </Column>
        )}

        {status === 'erro' && (
          <EmptyState
            title="Não foi possível carregar"
            description={erro ?? undefined}
            actionLabel="Tentar novamente"
            onAction={tela.recarregar}
          />
        )}

        {/* Sem ação no estado vazio: o FAB "Nova dívida" já está na tela. */}
        {status === 'pronto' && dividas.length === 0 && (
          <EmptyState
            title="Nenhuma dívida cadastrada"
            description="Cadastre um financiamento para gerar as parcelas no caixa."
          />
        )}
      </ScreenColumn>

      {status === 'pronto' && dividas.length > 0 && (
        <List
          data={dividas}
          keyExtractor={(divida) => divida.id}
          contentContainerStyle={[coluna, styles.espacoDoFab]}
          ListHeaderComponent={
            <Column gap="lg">
              <ResumoDasDividas dividas={dividas} />
              <Text weight="semibold" accessibilityRole="header">
                {`Ativas · ${dividas.length}`}
              </Text>
            </Column>
          }
          ListHeaderComponentStyle={styles.cabecalho}
          renderItem={({ item }) => (
            <ListItem
              icon="dividas"
              title={item.descricao}
              subtitle={subtitulo(item, hoje)}
              // À direita, o que ainda falta pagar dela; quitada, o selo diz isso no lugar do valor zero.
              trailing={
                item.proximaParcela ? (
                  <Text weight="medium">{formatarMoeda(item.saldoPendenteCentavos)}</Text>
                ) : (
                  <Badge label="Quitada" tone="neutral" />
                )
              }
              onPress={() => router.push(`/dividas/${item.id}`)}
              accessibilityLabel={`${item.descricao}, falta pagar ${formatarMoeda(item.saldoPendenteCentavos)}, ${rotuloParcelasPagas(item)}`}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
  cabecalho: {
    paddingBottom: spacing.xs,
  },
  divisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
