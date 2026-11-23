import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import type { ViagemDetalhada } from '@/features/viagens/types';
import { dataLocalISO, hojeISO, isoParaDataBR } from '@/lib/datas';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { Card, Column, EmptyState, Icon, Screen, Skeleton, Snackbar, Text, type IconName } from '@/ui';
import { spacing } from '@/ui/tokens';

import { CabecalhoInicio } from './CabecalhoInicio';
import { buscarInicioFrota, type ContagemFrota } from './inicioFrotaRepository';
import { pedeAtencaoFrota } from './pedeAtencao';
import { SecaoPedeAtencao } from './SecaoPedeAtencao';

// "saiu às 08:15" se foi hoje; "saiu em 21/11 às 08:15" se a viagem atravessou a noite. A hora é a do
// relógio do celular do motorista (EIX-76), mostrada no fuso deste aparelho.
export function saida(viagem: ViagemDetalhada, hoje: string): string {
  const instante = viagem.data_inicio ?? viagem.data_inclusao;
  const data = new Date(instante);
  const hora = `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
  const dia = dataLocalISO(data);
  return dia === hoje ? `saiu às ${hora}` : `saiu em ${isoParaDataBR(dia).slice(0, 5)} às ${hora}`;
}

function trecho(viagem: ViagemDetalhada): string {
  return viagem.rota ? `${viagem.rota.cidade_origem} → ${viagem.rota.cidade_destino}` : 'Rota não informada';
}

function CartaoNaEstrada({ viagens, hoje, onPress }: { viagens: ViagemDetalhada[]; hoje: string; onPress: () => void }) {
  const titulo = viagens.length === 0 ? 'Nenhum veículo na estrada' : `${viagens.length} na estrada`;
  return (
    <Card variant="feature" onPress={onPress} accessibilityLabel={`Viagens em andamento: ${titulo}. Ver viagens`}>
      <Text variant="bodySm" tone="body">
        Viagens em andamento
      </Text>
      <Text variant={viagens.length === 0 ? 'subheading' : 'display'} weight="semibold">
        {titulo}
      </Text>
      {viagens.map((viagem) => (
        <Column key={viagem.id} gap="xs">
          <Text weight="medium" numberOfLines={1}>
            {`${viagem.veiculo?.placa ?? 'Veículo'} · ${trecho(viagem)}`}
          </Text>
          <Text variant="bodySm" tone="body" numberOfLines={1}>
            {[viagem.motorista?.nome, saida(viagem, hoje)].filter(Boolean).join(' · ')}
          </Text>
        </Column>
      ))}
    </Card>
  );
}

const STATUS_DA_FROTA: { status: keyof ContagemFrota; rotulo: string; icone: IconName }[] = [
  { status: 'Disponivel', rotulo: 'Disponíveis', icone: 'sucesso' },
  { status: 'EmViagem', rotulo: 'Em viagem', icone: 'viagens' },
  { status: 'EmManutencao', rotulo: 'Manutenção', icone: 'manutencoes' },
];

function ContagemVeiculos({ contagem, onPress }: { contagem: ContagemFrota; onPress: () => void }) {
  return (
    <View testID="contagem-frota" style={styles.contagem}>
      {STATUS_DA_FROTA.map(({ status, rotulo, icone }) => (
        <View key={status} style={styles.contador}>
          <Card onPress={onPress} accessibilityLabel={`${contagem[status]} ${rotulo}. Ver veículos`}>
            <Icon name={icone} tone="body" />
            <Column gap="xs">
              <Text variant="heading" weight="semibold">
                {String(contagem[status])}
              </Text>
              <Text variant="caption" tone="body" numberOfLines={1}>
                {rotulo}
              </Text>
            </Column>
          </Card>
        </View>
      ))}
    </View>
  );
}

// Início do Gestor de Frota (protótipo DESIGN-CYAN 2.0, direção A): quem está na estrada agora, como
// está a frota e o que pede atenção. O cartão vivo ainda não estima a chegada: falta o tempo médio de
// cada rota, que vem numa RPC própria.
export function InicioFrotaView() {
  const router = useRouter();
  const { usuario } = useProfile();
  const [agora] = useState(() => new Date());
  const buscar = useCallback(() => buscarInicioFrota(), []);
  const tela = useDadosDaTela(buscar);
  const hoje = hojeISO();

  return (
    <Screen
      scroll
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : undefined
      }
    >
      <CabecalhoInicio nome={usuario?.nome ?? ''} agora={agora} />

      {tela.status === 'carregando' && (
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando o início" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
      )}

      {tela.status === 'erro' && (
        <EmptyState
          icon="alerta"
          title="Não deu para carregar o início"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
      )}

      {tela.status === 'pronto' && tela.dados && (
        <>
          <CartaoNaEstrada viagens={tela.dados.viagensEmAndamento} hoje={hoje} onPress={() => router.push('/viagens')} />
          <ContagemVeiculos contagem={tela.dados.veiculos} onPress={() => router.push('/frota/veiculos')} />
          <SecaoPedeAtencao
            itens={pedeAtencaoFrota({ ...tela.dados, hoje })}
            textoVazio="Nenhuma revisão pendente e nenhum veículo parado."
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  contagem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contador: {
    flex: 1,
  },
});
