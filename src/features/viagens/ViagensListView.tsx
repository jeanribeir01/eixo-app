import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  FAB,
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
import type { StatusViagem, ViagemDetalhada } from './types';
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
  Finalizada: { label: 'Finalizada', tone: 'success' },
  Cancelada: { label: 'Cancelada', tone: 'neutral' },
};

export function ViagensListView() {
  const router = useRouter();

  const [statusCarga, setStatusCarga] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [viagens, setViagens] = useState<ViagemDetalhada[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('Todos');
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setStatusCarga('carregando');
    setErroMensagem(null);

    const resultado = await listarViagens();

    if (!resultado.ok) {
      setErroMensagem(resultado.mensagem);
      setStatusCarga('erro');
      return;
    }

    setViagens(resultado.data);
    setStatusCarga('pronto');
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const viagensFiltradas = viagens.filter((v) => {
    if (filtroStatus === 'Todos') return true;
    return v.status === filtroStatus;
  });

  return (
    <Screen
      scroll
      fab={
        <FAB
          label="Abrir viagem"
          icon="adicionar"
          onPress={() => router.push('/viagens/nova')}
        />
      }
      overlay={
        erroMensagem && statusCarga === 'pronto' ? (
          <Snackbar message={erroMensagem} tone="error" onDismiss={() => setErroMensagem(null)} />
        ) : undefined
      }
    >
      <Column gap="lg">
        {/* Aba não tem header nativo; o título fica no conteúdo (DESIGN_CYAN §7) */}
        <Text variant="heading">Viagens</Text>

        {/* Filtro de status em pílulas */}
        <Tabs
          options={opcoesFiltro}
          value={filtroStatus}
          onChange={(val) => setFiltroStatus(val as FiltroStatus)}
        />

        {statusCarga === 'carregando' && (
          <View style={styles.centro}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {statusCarga === 'erro' && (
          <EmptyState
            icon="viagens"
            title="Não foi possível carregar as viagens"
            description={erroMensagem ?? 'Verifique sua conexão e tente novamente.'}
            actionLabel="Tentar novamente"
            onAction={carregar}
          />
        )}

        {statusCarga === 'pronto' && viagensFiltradas.length === 0 && (
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
        )}

        {statusCarga === 'pronto' &&
          viagensFiltradas.map((item) => {
            // Passo 3.1: Cálculo offline km_rodado ?? (hodometro_final - hodometro_inicial)
            const kmRodado = calcularKmRodado(item);
            const statusConfig = badgePorStatus[item.status];
            // Passo 3.3: Aviso visual se ultrapassar muito a estimativa da rota
            const distanciaExcessiva = distanciaUltrapassaEstimativa(
              kmRodado,
              item.rota?.distancia_estimada_km,
            );

            return (
              <Card key={item.id}>
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

                  {/* Feedback visual de discrepância (Passo 3.3) */}
                  {distanciaExcessiva && (
                    <Badge
                      tone="danger"
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
          })}
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
