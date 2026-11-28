import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import { dataLocalISO, horaLocal, isoParaDataBR } from '@/lib/datas';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Aviso,
  Badge,
  ChipFiltro,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  LinhaDeFiltros,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
  useScreenColumn,
  type TabOption,
} from '@/ui';

import { calcularKmRodado, distanciaUltrapassaEstimativa, formatarKm } from './calculo';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';
import { contarRevisoesPendentes } from './revisoesRepository';
import { useSyncStore } from './syncStore';
import type { StatusViagem, ViagemDetalhada } from './types';
import { listarViagens } from './viagensRepository';

type FiltroStatus = StatusViagem | 'Todos';

const opcoesFiltro: TabOption[] = [
  { label: 'Todas', value: 'Todos' },
  { label: 'Em andamento', value: 'EmAndamento' },
  { label: 'Concluídas', value: 'Finalizada' },
  { label: 'Canceladas', value: 'Cancelada' },
];

type ViagensListViewProps = {
  // Aberta pelo hub Frota (Admin, que não tem a aba Viagens), a tela fica sob o header nativo, que
  // já mostra o título.
  underHeader?: boolean;
};

export function ViagensListView({ underHeader = false }: ViagensListViewProps) {
  const router = useRouter();
  const { usuario } = useProfile();
  const ehMotorista = usuario?.perfil === 'Motorista';
  const ehAdminOuGestor = usuario?.perfil === 'Admin' || usuario?.perfil === 'Gestor de Frota';

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('Todos');
  const coluna = useScreenColumn();
  const sincronizando = useSyncStore((state) => state.sincronizando);
  const ultimaSincronizacaoEm = useSyncStore((state) => state.ultimaSincronizacaoEm);

  // A leitura é sempre local. O filtro por motorista impede que um Motorista veja no cache uma
  // viagem de outra conta que ainda não foi limpa; o RLS já fez o mesmo no servidor.
  const buscar = useCallback(
    () =>
      listarViagens({
        status: filtroStatus,
        ...(ehMotorista && usuario ? { motorista_id: usuario.id } : {}),
      }),
    [ehMotorista, filtroStatus, usuario],
  );
  // A lista vem do banco local (offline-first): sem internet ela carrega normalmente, e o
  // IndicadorSincronizacao já diz que a conexão caiu.
  const tela = useDadosDaTela(buscar, { precisaDeInternet: false });

  // A contagem também passa pelo hook de tela: ele recarrega no foco e quando o pull termina.
  // Incluir `ultimaSincronizacaoEm` na consulta faz o hook reler a fila depois da sincronização.
  const buscarRevisoes = useCallback(async () => {
    // O timestamp não vai na requisição: ele muda a identidade da consulta para o hook refazer a
    // contagem quando o pull termina. Sem isso, o aviso de revisões ficaria com o valor antigo.
    void ultimaSincronizacaoEm;
    if (!ehAdminOuGestor) return { ok: true as const, data: 0 };
    return contarRevisoesPendentes();
  }, [ehAdminOuGestor, ultimaSincronizacaoEm]);
  const revisoes = useDadosDaTela(buscarRevisoes);
  const revisoesPendentes = revisoes.dados ?? 0;

  const puxarParaAtualizar = useCallback(async () => {
    // Primeiro tenta enviar o que está na outbox e trazer o servidor; depois relê o SQLite.
    // Offline, `sincronizarTudo` não faz nada e a releitura local continua funcionando.
    await useSyncStore.getState().sincronizarTudo();
    await Promise.all([tela.puxarParaAtualizar(), revisoes.puxarParaAtualizar()]);
  }, [tela, revisoes]);

  // Agrupadas por status, na ordem em que o gestor age: primeiro o que está na estrada.
  const linhas = useMemo(() => agruparPorStatus(tela.dados ?? []), [tela.dados]);

  const cabecalho = (
    <Column gap="lg">
      <IndicadorSincronizacao />

      {ehAdminOuGestor && revisoesPendentes > 0 && (
        <Aviso
          tom="warning"
          icone="alerta"
          titulo={
            revisoesPendentes === 1
              ? '1 viagem precisa de revisão'
              : `${revisoesPendentes} viagens precisam de revisão`
          }
          acao={{ label: 'Ver revisões', onPress: () => router.push('/viagens/revisoes') }}
        >
          O envio de um registro foi recusado. O que o motorista registrou ficou guardado para você decidir.
        </Aviso>
      )}
    </Column>
  );

  return (
    <Screen
      list
      underHeader={underHeader}
      fab={
        <FAB
          label="Abrir viagem"
          icon="adicionar"
          onPress={() => router.push('/viagens/nova')}
        />
      }
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : undefined
      }
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com os cartões (EIX-94). */}
      <ScreenColumn>
        {/* Aba não tem header nativo; o título fica no conteúdo (DESIGN_CYAN §7) */}
        {!underHeader && <Text variant="heading">Viagens</Text>}

        {/* Chip no lugar da fileira de abas: "Em andamento" não quebra mais em três linhas
            (referência Nubank do redesign). */}
        <LinhaDeFiltros accessibilityLabel="Filtros">
          <ChipFiltro
            label="Status"
            value={filtroStatus}
            valorPadrao="Todos"
            options={opcoesFiltro}
            onChange={(val) => {
              // O snackbar de erro pertence à consulta anterior; não deve sobreviver ao filtro novo.
              tela.limparFeedbackErro();
              setFiltroStatus(val as FiltroStatus);
            }}
          />
        </LinhaDeFiltros>

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando viagens" />
            <Skeleton height="xxl" />
            <Skeleton height="xxl" />
          </Column>
        )}

        {tela.status === 'erro' && (
          <EmptyState
            icon="viagens"
            title="Não foi possível carregar as viagens"
            description={tela.erro ?? 'Verifique sua conexão e tente novamente.'}
            actionLabel="Tentar novamente"
            onAction={tela.recarregar}
          />
        )}
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <FlatList
          data={linhas}
          keyExtractor={chaveDaLinha}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.conteudoLista]}
          ListHeaderComponent={cabecalho}
          ListHeaderComponentStyle={styles.cabecalhoLista}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando || sincronizando}
              onRefresh={puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="viagens"
              title="Nenhuma viagem encontrada"
              description={
                filtroStatus === 'Todos'
                  ? 'Nenhuma viagem registrada ainda. Abra a primeira viagem.'
                  : 'Nenhuma viagem com esse status no momento.'
              }
              actionLabel={filtroStatus !== 'Todos' ? 'Ver todas' : undefined}
              onAction={filtroStatus !== 'Todos' ? () => setFiltroStatus('Todos') : undefined}
            />
          }
          renderItem={renderLinha}
        />
      )}
    </Screen>
  );
}

// A lista vira cabeçalhos e linhas numa FlatList só, como Movimentações por dia: com 90 viagens
// concluídas, um bloco único por grupo desenharia todas de uma vez, sem a virtualização da lista.
type Linha =
  | { tipo: 'grupo'; id: string; rotulo: string }
  | { tipo: 'viagem'; id: string; viagem: ViagemDetalhada };

const ORDEM_DOS_GRUPOS: { status: StatusViagem; rotulo: string }[] = [
  { status: 'EmAndamento', rotulo: 'Na estrada' },
  { status: 'Finalizada', rotulo: 'Concluídas' },
  { status: 'Cancelada', rotulo: 'Canceladas' },
];

function agruparPorStatus(viagens: ViagemDetalhada[]): Linha[] {
  const linhas: Linha[] = [];
  for (const { status, rotulo } of ORDEM_DOS_GRUPOS) {
    const doGrupo = viagens.filter((viagem) => viagem.status === status);
    if (doGrupo.length === 0) continue;
    linhas.push({ tipo: 'grupo', id: `grupo-${status}`, rotulo: `${rotulo} · ${doGrupo.length}` });
    for (const viagem of doGrupo) linhas.push({ tipo: 'viagem', id: viagem.id, viagem });
  }
  return linhas;
}

function chaveDaLinha(linha: Linha): string {
  return linha.id;
}

function renderLinha({ item }: ListRenderItemInfo<Linha>) {
  return item.tipo === 'grupo' ? (
    <View style={styles.grupo}>
      <Text weight="semibold" accessibilityRole="header">
        {item.rotulo}
      </Text>
    </View>
  ) : (
    <LinhaDaViagem viagem={item.viagem} />
  );
}

// "22/11" no fuso do aparelho: o banco guarda o instante em UTC.
function diaLocal(iso: string): string {
  return isoParaDataBR(dataLocalISO(new Date(iso))).slice(0, 5);
}

// "Carlos Almeida · saída às 10:00" na estrada; "Carlos Almeida · 21/11 · 432 km" depois de concluída.
function resumoDaViagem(viagem: ViagemDetalhada): string {
  const partes: string[] = [];
  if (viagem.motorista) partes.push(viagem.motorista.nome);

  if (viagem.status === 'EmAndamento' && viagem.data_inicio) {
    const hoje = dataLocalISO(new Date()) === dataLocalISO(new Date(viagem.data_inicio));
    partes.push(hoje ? `saída às ${horaLocal(viagem.data_inicio)}` : `saída em ${diaLocal(viagem.data_inicio)}`);
  } else if (viagem.data_inicio) {
    partes.push(diaLocal(viagem.data_inicio));
  }

  const km = calcularKmRodado(viagem);
  if (viagem.status === 'Finalizada' && km !== null) partes.push(formatarKm(km));

  return partes.join(' · ');
}

// Uma linha por viagem, no lugar do cartão com seis linhas de texto: placa e trecho no título, quem e
// quando embaixo. O status vem do grupo; o selo à direita fica só para o que pede atenção.
// Memoizada: um Snackbar ou o pull-to-refresh não redesenha as linhas que não mudaram (EIX-71).
const LinhaDaViagem = memo(function LinhaDaViagem({ viagem }: { viagem: ViagemDetalhada }) {
  const router = useRouter();
  const placa = viagem.veiculo?.placa ?? 'Veículo';
  const trecho = viagem.rota ? `${viagem.rota.cidade_origem} → ${viagem.rota.cidade_destino}` : 'Rota não informada';
  // Passo 3.3: km bem acima da estimativa da rota costuma ser hodômetro digitado errado.
  const distanciaExcessiva = distanciaUltrapassaEstimativa(calcularKmRodado(viagem), viagem.rota?.distancia_estimada_km);

  // Verde e vermelho ficam para dinheiro (DESIGN_CYAN): o que pede atenção usa o tom de alerta, sempre
  // com o texto dizendo o porquê.
  const selo = viagem.em_revisao ? (
    <Badge label="Em revisão" tone="warning" />
  ) : distanciaExcessiva ? (
    <Badge label="Acima da rota" tone="warning" />
  ) : undefined;

  return (
    <ListItem
      icon={viagem.em_revisao ? 'alerta' : 'viagens'}
      iconTone={viagem.em_revisao ? 'warning' : 'body'}
      title={`${placa} · ${trecho}`}
      subtitle={resumoDaViagem(viagem)}
      trailing={selo}
      // Toda viagem abre o Detalhe, em qualquer status; "Finalizar viagem" fica lá, para a que está na estrada.
      onPress={() => router.push(`/viagens/${viagem.id}`)}
    />
  );
});

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  conteudoLista: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
  cabecalhoLista: {
    paddingBottom: spacing.sm,
  },
  grupo: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
});
