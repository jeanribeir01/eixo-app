import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import { canSeeFinanceiro, canSeeFrota } from '@/features/auth/permissions';
import { formatarPlaca } from '@/features/veiculos/placa';
import { dataLocalISO, horaLocal, isoParaDataBR } from '@/lib/datas';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Aviso,
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  ListItem,
  ListSection,
  Screen,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
} from '@/ui';

import { calcularKmRodado, distanciaUltrapassaEstimativa, formatarHodometro, formatarKm } from './calculo';
import type { StatusViagem, ViagemDetalhada } from './types';
import { buscarViagemPorId } from './viagensRepository';

// As mesmas palavras dos grupos da lista de Viagens e da aba Frota: "Na estrada", não "Em andamento".
const ROTULO_DO_STATUS: Record<StatusViagem, string> = {
  EmAndamento: 'Na estrada',
  Finalizada: 'Concluída',
  Cancelada: 'Cancelada',
};

// "27/11 às 10:00" no fuso do aparelho: o banco guarda o instante em UTC.
function quando(iso: string): string {
  return `${isoParaDataBR(dataLocalISO(new Date(iso))).slice(0, 5)} às ${horaLocal(iso)}`;
}

// "45 min", "8 h 30 min", "1 dia 4 h": o tempo entre dois instantes, na maior unidade que ajuda.
export function duracao(inicioISO: string, fimISO: string): string {
  const minutos = Math.max(0, Math.round((new Date(fimISO).getTime() - new Date(inicioISO).getTime()) / 60_000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return minutos % 60 === 0 ? `${horas} h` : `${horas} h ${minutos % 60} min`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}${resto > 0 ? ` ${resto} h` : ''}`;
}

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

// O número grande do cartão: quanto rodou depois de concluída; há quanto tempo está na estrada antes.
function Destaque({ viagem, km }: { viagem: ViagemDetalhada; km: number | null }) {
  const estimativa = viagem.rota ? `Estimativa da rota: ${formatarKm(viagem.rota.distancia_estimada_km)}` : null;

  if (viagem.status === 'EmAndamento' && km === null) {
    if (!viagem.data_inicio) return estimativa ? <Text tone="body">{estimativa}</Text> : null;
    return (
      <Column gap="xs">
        <Text variant="caption" tone="body">
          Na estrada há
        </Text>
        <Text variant="display" weight="semibold">
          {duracao(viagem.data_inicio, new Date().toISOString())}
        </Text>
        {estimativa && <Text tone="body">{estimativa}</Text>}
      </Column>
    );
  }

  return (
    <Column gap="xs">
      <Text variant="caption" tone="body">
        Km rodados
      </Text>
      <Text variant="display" weight="semibold">
        {formatarKm(km)}
      </Text>
      {estimativa && <Text tone="body">{estimativa}</Text>}
    </Column>
  );
}

export type ViagemDetalheViewProps = {
  viagemId: string;
};

// Detalhe da viagem (`/viagens/<id>`), aberto por qualquer linha da lista de Viagens. Os dados da viagem
// moram no cartão; embaixo, só linhas que abrem alguma coisa. A viagem vem do banco local (offline-first),
// então a tela abre sem internet.
export function ViagemDetalheView({ viagemId }: ViagemDetalheViewProps) {
  const router = useRouter();
  const { usuario } = useProfile();
  const buscar = useCallback(() => buscarViagemPorId(viagemId), [viagemId]);
  // A viagem vem do banco local (offline-first): sem internet a tela carrega normalmente.
  const tela = useDadosDaTela(buscar, { precisaDeInternet: false });
  const viagem = tela.dados;

  if (tela.status === 'carregando') {
    return (
      <Screen underHeader>
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando viagem" />
          <Skeleton height="xxl" />
        </Column>
      </Screen>
    );
  }

  if (tela.status === 'erro' || !viagem) {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          icon="viagens"
          title="Não foi possível carregar a viagem"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const km = calcularKmRodado(viagem);
  const acimaDaRota = distanciaUltrapassaEstimativa(km, viagem.rota?.distancia_estimada_km);
  // Sem a UF, como na lista: "Belo Horizonte/MG" quebrava a linha no meio, depois da barra.
  const trecho = viagem.rota ? `${viagem.rota.cidade_origem} → ${viagem.rota.cidade_destino}` : 'Rota não informada';
  const placa = viagem.veiculo ? formatarPlaca(viagem.veiculo.placa) : null;
  const quem = [viagem.motorista?.nome, placa].filter(Boolean).join(' · ');
  // A linha do veículo só abre para quem vê a Frota; os lançamentos, para quem vê o Caixa (Admin). O
  // Motorista e o Gestor não leem movimentação: a linha nem aparece para eles.
  const abreVeiculo = canSeeFrota(usuario) && viagem.veiculo;
  const veLancamentos = canSeeFinanceiro(usuario);
  const emAndamento = viagem.status === 'EmAndamento';

  return (
    // O título "Viagem" fica no header; o trecho aparece no cartão porque é dado.
    <Screen
      underHeader
      scroll
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <Column gap="lg">
        {viagem.em_revisao && (
          <Aviso
            tom="warning"
            icone="alerta"
            titulo="Em revisão"
            acao={canSeeFrota(usuario) ? { label: 'Ver revisões', onPress: () => router.push('/viagens/revisoes') } : undefined}
          >
            O envio desta viagem foi recusado e um gestor vai decidir o que vale. Até lá, ela fica guardada neste
            aparelho.
          </Aviso>
        )}
        {!viagem.em_revisao && acimaDaRota && viagem.rota && (
          <Aviso tom="warning" icone="alerta" titulo="Acima da rota">
            {`Rodou ${formatarKm(km)}, e a rota estima ${formatarKm(viagem.rota.distancia_estimada_km)}. Confira o hodômetro final.`}
          </Aviso>
        )}

        <Card variant="feature">
          <View style={styles.topo}>
            <Text variant="bodySm" tone="body">
              Viagem
            </Text>
            <Badge label={ROTULO_DO_STATUS[viagem.status]} tone="neutral" />
          </View>
          <Column gap="xs">
            <Text variant="subheading" weight="semibold">
              {trecho}
            </Text>
            {quem.length > 0 && <Text tone="body">{quem}</Text>}
          </Column>
          <View style={styles.divisor} />
          <Destaque viagem={viagem} km={km} />
          <View style={styles.divisor} />
          <Column direction="row" gap="lg" wrap>
            {viagem.data_inicio && <Resumo rotulo="Saída" valor={quando(viagem.data_inicio)} />}
            {viagem.data_fim && (
              <Resumo rotulo={viagem.status === 'Cancelada' ? 'Cancelada em' : 'Chegada'} valor={quando(viagem.data_fim)} />
            )}
            {viagem.data_inicio && viagem.data_fim && (
              <Resumo rotulo="Duração" valor={duracao(viagem.data_inicio, viagem.data_fim)} />
            )}
            <Resumo rotulo="Hodômetro na saída" valor={formatarHodometro(viagem.hodometro_inicial)} />
            {viagem.hodometro_final !== null && (
              <Resumo rotulo="Hodômetro na chegada" valor={formatarHodometro(viagem.hodometro_final)} />
            )}
          </Column>
        </Card>

        {(abreVeiculo || veLancamentos) && (
          <ListSection label="Desta viagem">
            {abreVeiculo && viagem.veiculo && (
              <ListItem
                icon="frota"
                title={formatarPlaca(viagem.veiculo.placa)}
                subtitle={`${viagem.veiculo.marca} ${viagem.veiculo.modelo}`}
                accessibilityLabel={`Ver veículo ${formatarPlaca(viagem.veiculo.placa)}`}
                onPress={() => router.push(`/frota/${viagem.veiculo_id}`)}
              />
            )}
            {veLancamentos && (
              <ListItem
                icon="movimentacoes"
                title="Lançamentos da viagem"
                subtitle="Frete, combustível e pedágio"
                onPress={() => router.push(`/viagens/${viagem.id}/lancamentos`)}
              />
            )}
          </ListSection>
        )}

        {emAndamento && (
          <Button label="Finalizar viagem" onPress={() => router.push(`/viagens/${viagem.id}/fechar`)} />
        )}
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
