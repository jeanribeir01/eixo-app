import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

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
import type { StatusViagem } from './types';
import { listarViagens } from './viagensRepository';

type FiltroStatus = StatusViagem | 'Todos';

const opcoesFiltro: TabOption[] = [
  { label: 'Todas', value: 'Todos' },
  { label: 'Em andamento', value: 'EmAndamento' },
  { label: 'Finalizadas', value: 'Finalizada' },
  { label: 'Canceladas', value: 'Cancelada' },
];

const badgePorStatus: Record<StatusViagem, { label: string; tone: BadgeTone }> = {
  EmAndamento: { label: 'Em andamento', tone: 'neutral' },
  Finalizada: { label: 'Finalizada', tone: 'neutral' },
  Cancelada: { label: 'Cancelada', tone: 'neutral' },
};

export function ViagensListView() {
  const router = useRouter();
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('Todos');

  // O status vai para o banco. Filtrar no cliente reduziria o filtro às 100 viagens mais recentes
  // de qualquer status, e uma viagem antiga ainda em andamento poderia sumir da lista.
  const buscar = useCallback(() => listarViagens({ status: filtroStatus }), [filtroStatus]);
  const tela = useDadosDaTela(buscar);

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

      {/* Filtro de status em pílulas */}
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
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até sem viagem nenhuma.
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
          renderItem={({ item }) => {
            // Passo 3.1: Cálculo offline km_rodado ?? (hodometro_final - hodometro_inicial)
            const kmRodado = calcularKmRodado(item);
            const statusConfig = badgePorStatus[item.status];
            // Passo 3.3: Aviso visual se ultrapassar muito a estimativa da rota
            const distanciaExcessiva = distanciaUltrapassaEstimativa(
              kmRodado,
              item.rota?.distancia_estimada_km,
            );

            return (
              <Card>
                <Column gap="sm">
                  {/* Cabeçalho do Card: Veículo e Status */}
                  <View style={styles.linhaTopo}>
                    <Text variant="body" weight="medium">
                      {item.veiculo ? `${item.veiculo.placa} • ${item.veiculo.modelo}` : 'Veículo'}
                    </Text>
                    <Badge label={statusConfig.label} tone={statusConfig.tone} />
                  </View>

                  {/* Trecho da rota */}
                  {item.rota && (
                    <Text variant="bodySm" tone="body">
                      {`${item.rota.cidade_origem}/${item.rota.uf_origem} → ${item.rota.cidade_destino}/${item.rota.uf_destino}`}
                      {item.rota.distancia_estimada_km ? ` (est. ${item.rota.distancia_estimada_km} km)` : ''}
                    </Text>
                  )}

                  {/* Motorista */}
                  {item.motorista && (
                    <Text variant="bodySm" tone="muted">
                      {`Motorista: ${item.motorista.nome}`}
                    </Text>
                  )}

                  {/* Hodômetros e Km Rodado */}
                  <View style={styles.dadosHodometro}>
                    <Text variant="bodySm" tone="body">
                      {`Início: ${formatarHodometro(item.hodometro_inicial)} km`}
                    </Text>
                    {item.hodometro_final !== null && (
                      <Text variant="bodySm" tone="body">
                        {`Fim: ${formatarHodometro(item.hodometro_final)} km`}
                      </Text>
                    )}
                  </View>

                  {/* Distância calculada (Cálculo Offline, Passo 3.1) */}
                  {kmRodado !== null && (
                    <Text variant="body" weight="medium">
                      {`Distância rodada: ${formatarKm(kmRodado)}`}
                    </Text>
                  )}

                  {/* Feedback visual de discrepância (Passo 3.3). Verde/vermelho são exclusivos
                      de valor financeiro; o texto já avisa do desvio. */}
                  {distanciaExcessiva && (
                    <Badge
                      tone="neutral"
                      label={`Km rodado (${formatarKm(kmRodado)}) acima da rota (${item.rota?.distancia_estimada_km} km)`}
                    />
                  )}

                  {/* Botão de Fechar Viagem (ghost, mantendo FAB como único cyan preenchido) */}
                  {item.status === 'EmAndamento' && (
                    <View style={styles.acaoRodape}>
                      <Button
                        variant="ghost"
                        label="Fechar viagem"
                        onPress={() => router.push(`/viagens/${item.id}/fechar`)}
                      />
                    </View>
                  )}
                </Column>
              </Card>
            );
          }}
        />
      )}
    </Screen>
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
  dadosHodometro: {
    flexDirection: 'row',
    gap: spacing.base,
    flexWrap: 'wrap',
  },
  acaoRodape: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
});
