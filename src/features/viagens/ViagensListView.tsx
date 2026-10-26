import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  Screen,
  Snackbar,
  Tabs,
  Text,
  colors,
  spacing,
  type BadgeTone,
  type TabOption,
} from '@/ui';

import { calcularKmRodado, distanciaUltrapassaEstimativa, formatarHodometro, formatarKm } from './calculo';
import { IndicadorSincronizacao } from './IndicadorSincronizacao';
import { contarRevisoesPendentes } from './revisoesRepository';
import { useSyncStore } from './syncStore';
import type { StatusViagem, ViagemDetalhada } from './types';
import { listarViagens } from './viagensRepository';

type FiltroStatus = StatusViagem | 'Todos';

const opcoesFiltro: TabOption[] = [
  { label: 'Todas', value: 'Todos' },
  { label: 'Em andamento', value: 'EmAndamento' },
  { label: 'Finalizadas', value: 'Finalizada' },
  { label: 'Canceladas', value: 'Cancelada' },
];

// O banco guarda "Finalizada", mas o critério de aceite da US08 exibe "Concluída"
// (mesmo padrão de EmManutencao → "Em Manutenção").
const badgePorStatus: Record<StatusViagem, { label: string; tone: BadgeTone }> = {
  EmAndamento: { label: 'Em andamento', tone: 'neutral' },
  Finalizada: { label: 'Concluída', tone: 'success' },
  Cancelada: { label: 'Cancelada', tone: 'neutral' },
};

export function ViagensListView() {
  const router = useRouter();
  const { usuario } = useProfile();
  const ehMotorista = usuario?.perfil === 'Motorista';
  const ehAdminOuGestor = usuario?.perfil === 'Admin' || usuario?.perfil === 'Gestor de Frota';

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('Todos');
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
  const tela = useDadosDaTela(buscar);

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

  const cabecalho = (
    <Column gap="lg">
      <IndicadorSincronizacao />

      {ehAdminOuGestor && revisoesPendentes > 0 && (
        <Card>
          <Column gap="sm">
            <Text variant="body" weight="medium">
              {revisoesPendentes === 1
                ? '1 viagem precisa de revisão'
                : `${revisoesPendentes} viagens precisam de revisão`}
            </Text>
            <Text variant="bodySm" tone="muted">
              O servidor recusou uma operação e o dado local foi preservado para você decidir.
            </Text>
            <View style={styles.acaoRevisao}>
              <Button
                variant="ghost"
                label="Ver revisões"
                onPress={() => router.push('/viagens/revisoes')}
              />
            </View>
          </Column>
        </Card>
      )}
    </Column>
  );

  return (
    <Screen
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
      {/* Aba não tem header nativo; o título fica no conteúdo (DESIGN_CYAN §7) */}
      <Text variant="heading">Viagens</Text>

      <Tabs
        options={opcoesFiltro}
        value={filtroStatus}
        onChange={(val) => {
          // O snackbar de erro pertence à consulta anterior; não deve sobreviver ao filtro novo.
          tela.limparFeedbackErro();
          setFiltroStatus(val as FiltroStatus);
        }}
      />

      {tela.status === 'carregando' && (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.accent} accessibilityLabel="Carregando viagens" />
        </View>
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

      {tela.status === 'pronto' && (
        <FlatList
          data={tela.dados ?? []}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          contentContainerStyle={styles.conteudoLista}
          ListHeaderComponent={cabecalho}
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
          renderItem={({ item }) => <CartaoViagem viagem={item} />}
        />
      )}
    </Screen>
  );
}

function CartaoViagem({ viagem }: { viagem: ViagemDetalhada }) {
  const router = useRouter();
  // Passo 3.1: km_rodado ?? (hodometro_final - hodometro_inicial)
  const kmRodado = calcularKmRodado(viagem);
  const statusConfig = badgePorStatus[viagem.status];
  // Passo 3.3: aviso visual se ultrapassar muito a estimativa da rota
  const distanciaExcessiva = distanciaUltrapassaEstimativa(
    kmRodado,
    viagem.rota?.distancia_estimada_km,
  );

  return (
    <Card>
      <Column gap="sm">
        <View style={styles.linhaTopo}>
          <Text variant="body" weight="medium">
            {viagem.veiculo ? `${viagem.veiculo.placa} • ${viagem.veiculo.modelo}` : 'Veículo'}
          </Text>
          <View style={styles.badges}>
            {viagem.em_revisao && <Badge label="Em revisão" tone="danger" />}
            <Badge label={statusConfig.label} tone={statusConfig.tone} />
          </View>
        </View>

        {viagem.rota && (
          <Text variant="bodySm" tone="body">
            {`${viagem.rota.cidade_origem}/${viagem.rota.uf_origem} → ${viagem.rota.cidade_destino}/${viagem.rota.uf_destino}`}
            {viagem.rota.distancia_estimada_km
              ? ` (est. ${viagem.rota.distancia_estimada_km} km)`
              : ''}
          </Text>
        )}

        {viagem.motorista && (
          <Text variant="bodySm" tone="muted">
            {`Motorista: ${viagem.motorista.nome}`}
          </Text>
        )}

        <View style={styles.dadosHodometro}>
          <Text variant="bodySm" tone="body">
            {`Início: ${formatarHodometro(viagem.hodometro_inicial)} km`}
          </Text>
          {viagem.hodometro_final !== null && (
            <Text variant="bodySm" tone="body">
              {`Fim: ${formatarHodometro(viagem.hodometro_final)} km`}
            </Text>
          )}
        </View>

        {kmRodado !== null && (
          <Text variant="body" weight="medium">
            {`Distância rodada: ${formatarKm(kmRodado)}`}
          </Text>
        )}

        {distanciaExcessiva && (
          <Badge
            tone="neutral"
            label={`Km rodado (${formatarKm(kmRodado)}) acima da rota (${viagem.rota?.distancia_estimada_km} km)`}
          />
        )}

        {viagem.em_revisao && (
          <Text variant="caption" tone="muted">
            Esta viagem tem uma operação aguardando revisão do gestor.
          </Text>
        )}

        {viagem.status === 'EmAndamento' && (
          <View style={styles.acaoRodape}>
            <Button
              variant="ghost"
              label="Fechar viagem"
              onPress={() => router.push(`/viagens/${viagem.id}/fechar`)}
            />
          </View>
        )}
      </Column>
    </Card>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  conteudoLista: {
    paddingBottom: FAB_ALTURA_RESERVADA,
    gap: spacing.lg,
  },
  centro: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linhaTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dadosHodometro: {
    flexDirection: 'row',
    gap: spacing.base,
    flexWrap: 'wrap',
  },
  acaoRodape: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  acaoRevisao: {
    alignSelf: 'flex-start',
  },
});
