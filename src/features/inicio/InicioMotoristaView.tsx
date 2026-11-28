import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import { calcularKmRodado, formatarHodometro, formatarKm } from '@/features/viagens/calculo';
import { IndicadorSincronizacao } from '@/features/viagens/IndicadorSincronizacao';
import { useSyncStore } from '@/features/viagens/syncStore';
import { rotuloStatusViagem, tomStatusViagem, type ViagemDetalhada } from '@/features/viagens/types';
import { listarViagens } from '@/features/viagens/viagensRepository';
import { dataLocalISO, horaLocal, isoParaDataBR } from '@/lib/datas';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { trechoDaViagem } from '@/lib/trecho';
import {
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  TituloSecao,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { CabecalhoInicio } from './CabecalhoInicio';

// "Campinas → Belo Horizonte": a cidade basta para o motorista; a UF fica para a lista do gestor.
// Data e km de uma viagem do histórico: "22/11/2026 · 532 km". Sem km (cancelada), diz o status.
function resumoDaViagem(viagem: ViagemDetalhada): string {
  const data = viagem.data_inicio ? isoParaDataBR(dataLocalISO(new Date(viagem.data_inicio))) : null;
  const km = calcularKmRodado(viagem);
  const detalhe =
    viagem.status === 'Finalizada' && km !== null ? formatarKm(km) : rotuloStatusViagem[viagem.status];
  return data ? `${data} · ${detalhe}` : detalhe;
}

function chaveDaViagem(viagem: ViagemDetalhada): string {
  return viagem.id;
}

function LinhaDoHistorico({ item }: ListRenderItemInfo<ViagemDetalhada>) {
  return (
    <ListItem
      icon="viagens"
      title={`${item.veiculo?.placa ?? 'Veículo'} · ${trechoDaViagem(item)}`}
      subtitle={resumoDaViagem(item)}
      // Em revisão: o gestor ainda vai decidir sobre algo que o motorista registrou sem internet.
      trailing={item.em_revisao ? <Badge label="Em revisão" tone="warning" /> : undefined}
    />
  );
}

type ViagemAtualProps = {
  viagem: ViagemDetalhada | null;
  onAbrir: () => void;
  onFinalizar: (id: string) => void;
};

// O cartão de destaque da tela: a viagem de agora e a única ação que importa nela. Sem viagem, o
// mesmo lugar convida a abrir uma. Um botão preenchido só por tela (DESIGN_CYAN §7).
function ViagemAtual({ viagem, onAbrir, onFinalizar }: ViagemAtualProps) {
  if (!viagem) {
    return (
      <Card variant="feature">
        <Text variant="bodySm" tone="body">
          Sua viagem
        </Text>
        <Text variant="subheading" weight="semibold">
          Nenhuma viagem em andamento
        </Text>
        <Text tone="body">Ao sair com o caminhão, abra a viagem com a placa e o hodômetro do painel.</Text>
        <Button label="Abrir viagem" onPress={onAbrir} />
      </Card>
    );
  }

  const placa = viagem.veiculo?.placa ?? 'Veículo';
  return (
    <Card variant="feature">
      {/* O status fica dentro do cartão, ao lado do rótulo, e não solto acima dele. */}
      <View style={styles.topo}>
        <Text variant="bodySm" tone="body">
          Sua viagem
        </Text>
        <Badge label={rotuloStatusViagem[viagem.status]} tone={tomStatusViagem[viagem.status]} />
      </View>
      <Column gap="xs">
        <Text variant="display" weight="semibold">
          {placa}
        </Text>
        <Text tone="body">{trechoDaViagem(viagem)}</Text>
      </Column>
      <View style={styles.divisor} />
      <Text variant="bodySm" tone="body">
        {viagem.data_inicio
          ? `Saída às ${horaLocal(viagem.data_inicio)} · hodômetro ${formatarHodometro(viagem.hodometro_inicial)} km`
          : `Hodômetro na saída: ${formatarHodometro(viagem.hodometro_inicial)} km`}
      </Text>
      <Column gap="xs">
        <Text weight="medium">Próxima etapa: registrar a chegada</Text>
        <Text variant="bodySm" tone="body">
          Ao chegar, informe o hodômetro final para concluir a viagem.
        </Text>
      </Column>
      {viagem.em_revisao && (
        <Text variant="bodySm" tone="body">
          O gestor está revisando um registro desta viagem.
        </Text>
      )}
      <Button label="Finalizar viagem" onPress={() => onFinalizar(viagem.id)} />
    </Card>
  );
}

// Início do Motorista, na aba Viagens: a viagem de agora em destaque e o histórico embaixo. Lê só o
// SQLite do aparelho (offline-first, RNF01); o pull-to-refresh tenta sincronizar antes de reler.
export function InicioMotoristaView() {
  const router = useRouter();
  const { usuario } = useProfile();
  const coluna = useScreenColumn();
  const sincronizando = useSyncStore((state) => state.sincronizando);
  const agora = useMemo(() => new Date(), []);

  // Filtro pelo próprio motorista: o cache local pode ter viagem de outra conta ainda não limpa.
  const buscar = useCallback(
    () => listarViagens({ status: 'Todos', ...(usuario ? { motorista_id: usuario.id } : {}) }),
    [usuario],
  );
  // As viagens vêm do banco local (offline-first): sem internet a tela carrega normalmente.
  const tela = useDadosDaTela(buscar, { precisaDeInternet: false });

  // Terminou uma sincronização (ao abrir o app, ao voltar a internet): relê o SQLite sem skeleton. No
  // primeiro login a tela abre antes de a primeira descida terminar e ficaria sem o histórico.
  const ultimaSincronizacaoEm = useSyncStore((state) => state.ultimaSincronizacaoEm);
  const recarregar = useRef(tela.recarregar);
  useEffect(() => {
    recarregar.current = tela.recarregar;
  });
  useEffect(() => {
    if (ultimaSincronizacaoEm !== null) recarregar.current();
  }, [ultimaSincronizacaoEm]);

  const { atual, historico } = useMemo(() => {
    const viagens = tela.dados ?? [];
    return {
      atual: viagens.find((viagem) => viagem.status === 'EmAndamento') ?? null,
      historico: viagens.filter((viagem) => viagem.status !== 'EmAndamento'),
    };
  }, [tela.dados]);

  const puxarParaAtualizar = useCallback(async () => {
    // Primeiro tenta enviar a outbox e trazer o servidor; offline, só relê o SQLite.
    await useSyncStore.getState().sincronizarTudo();
    await tela.puxarParaAtualizar();
  }, [tela]);

  const abrir = useCallback(() => router.push('/viagens/nova'), [router]);
  const finalizar = useCallback((id: string) => router.push(`/viagens/${id}/fechar`), [router]);

  return (
    <Screen
      list
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : undefined
      }
    >
      <ScreenColumn>
        <CabecalhoInicio nome={usuario?.nome ?? ''} agora={agora} />

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando suas viagens" />
            <Skeleton height="xxl" />
          </Column>
        )}

        {tela.status === 'erro' && (
          <EmptyState
            icon="viagens"
            title="Não foi possível carregar suas viagens"
            description={tela.erro ?? 'Tente de novo em instantes.'}
            actionLabel="Tentar novamente"
            onAction={tela.recarregar}
          />
        )}
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <FlatList
          // No celular a lista fica dentro do respiro lateral da tela: a barra de rolagem do Android
          // aparecia por cima das setas e dos valores das linhas.
          showsVerticalScrollIndicator={false}
          data={historico}
          keyExtractor={chaveDaViagem}
          style={styles.lista}
          contentContainerStyle={coluna}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando || sincronizando}
              onRefresh={puxarParaAtualizar}
              colors={[colors.accentStrong]}
              tintColor={colors.accentStrong}
            />
          }
          ListHeaderComponent={
            <Column gap="lg">
              <IndicadorSincronizacao />
              <ViagemAtual viagem={atual} onAbrir={abrir} onFinalizar={finalizar} />
              <TituloSecao titulo="Suas viagens" />
            </Column>
          }
          ListHeaderComponentStyle={styles.cabecalhoLista}
          ListEmptyComponent={
            <Text tone="body">As viagens concluídas aparecem aqui, com a data e os km rodados.</Text>
          }
          renderItem={LinhaDoHistorico}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  cabecalhoLista: {
    paddingBottom: spacing.sm,
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
});
