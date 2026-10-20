import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  Input,
  Screen,
  Snackbar,
  Text,
  colors,
  radius,
  spacing,
} from '@/ui';

import {
  calcularKmRodado,
  distanciaUltrapassaEstimativa,
  formatarHodometro,
  formatarKm,
} from './calculo';
import type { ViagemDetalhada } from './types';
import { buscarViagemPorId, fecharViagem } from './viagensRepository';

export type FecharViagemViewProps = {
  viagemId: string;
};

type Feedback = {
  mensagem: string;
  tone: 'success' | 'error';
};

export function FecharViagemView({ viagemId }: FecharViagemViewProps) {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [viagem, setViagem] = useState<ViagemDetalhada | null>(null);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [hodometroFinal, setHodometroFinal] = useState('');
  const [erroHodometro, setErroHodometro] = useState<string | null>(null);
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErroCarregamento(null);

      const resultado = await buscarViagemPorId(viagemId);

      if (cancelado) return;

      if (!resultado.ok) {
        setErroCarregamento(resultado.mensagem);
        setCarregando(false);
        return;
      }

      setViagem(resultado.data);
      setCarregando(false);
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [viagemId]);

  const valorFinalNum = Number(hodometroFinal.replace(',', '.'));
  const hodometroValido = !isNaN(valorFinalNum) && hodometroFinal.trim().length > 0;
  const hodometroInicial = viagem?.hodometro_inicial ?? 0;

  // Passo 3.1: Cálculo Offline da quilometragem
  const kmCalculado =
    hodometroValido && valorFinalNum > hodometroInicial
      ? calcularKmRodado({
          hodometro_inicial: hodometroInicial,
          hodometro_final: valorFinalNum,
          km_rodado: null,
        })
      : null;

  // Passo 3.3: Aviso Visual se a distância rodada passar muito da estimativa da rota
  const distanciaExcessiva = distanciaUltrapassaEstimativa(
    kmCalculado,
    viagem?.rota?.distancia_estimada_km,
  );

  function solicitarConfirmacao() {
    if (!hodometroValido || valorFinalNum <= 0) {
      setErroHodometro('Informe um hodômetro final válido maior que zero.');
      return;
    }

    if (valorFinalNum <= hodometroInicial) {
      setErroHodometro(
        `O hodômetro final deve ser maior que o inicial (${formatarHodometro(hodometroInicial)} km).`,
      );
      return;
    }

    setErroHodometro(null);
    // Passo 3.2: Abre modal de confirmação com o texto exigido
    setModalConfirmacaoAberto(true);
  }

  async function executarFechamento() {
    setModalConfirmacaoAberto(false);
    setFechando(true);

    // REGRA CRÍTICA: km_rodado NUNCA é enviado no update
    const resultado = await fecharViagem(viagemId, {
      hodometro_final: valorFinalNum,
    });

    setFechando(false);

    if (!resultado.ok) {
      if (resultado.campo === 'hodometro_final') {
        setErroHodometro(resultado.mensagem);
      }
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    setFeedback({ mensagem: 'Viagem finalizada com sucesso!', tone: 'success' });
    setTimeout(() => {
      router.back();
    }, 600);
  }

  return (
    <Screen
      scroll
      underHeader
      overlay={
        feedback ? (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />
        ) : undefined
      }
    >
      {carregando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : erroCarregamento || !viagem ? (
        <EmptyState
          icon="viagens"
          title="Erro ao carregar viagem"
          description={erroCarregamento ?? 'Viagem não encontrada.'}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      ) : viagem.status !== 'EmAndamento' ? (
        <EmptyState
          icon="viagens"
          title="Viagem já encerrada"
          description={`Esta viagem está com o status "${viagem.status}" e não pode ser fechada novamente.`}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      ) : (
        <Column gap="lg">
          {/* Dados da viagem aberta */}
          <Card>
            <Column gap="sm">
              <View style={styles.linhaTopo}>
                <Text variant="subheading">Viagem em andamento</Text>
                <Badge label="Em andamento" tone="neutral" />
              </View>

              {viagem.veiculo && (
                <Text variant="body" weight="medium">
                  {`Veículo: ${viagem.veiculo.placa} • ${viagem.veiculo.modelo}`}
                </Text>
              )}

              {viagem.rota && (
                <Text variant="bodySm" tone="body">
                  {`Rota: ${viagem.rota.cidade_origem}/${viagem.rota.uf_origem} → ${viagem.rota.cidade_destino}/${viagem.rota.uf_destino}`}
                  {viagem.rota.distancia_estimada_km ? ` (est. ${viagem.rota.distancia_estimada_km} km)` : ''}
                </Text>
              )}

              {viagem.motorista && (
                <Text variant="bodySm" tone="muted">
                  {`Motorista: ${viagem.motorista.nome}`}
                </Text>
              )}

              <Text variant="body" weight="medium">
                {`Hodômetro Inicial: ${formatarHodometro(viagem.hodometro_inicial)} km`}
              </Text>
            </Column>
          </Card>

          {/* Formulário solicitando o Hodômetro Final */}
          <Card>
            <Column gap="md">
              <Text variant="subheading">Encerramento da viagem</Text>

              <Input
                label="Hodômetro Final (km)"
                placeholder={`Ex.: ${viagem.hodometro_inicial + 100}`}
                keyboardType="numeric"
                value={hodometroFinal}
                onChangeText={(texto) => {
                  setHodometroFinal(texto);
                  setErroHodometro(null);
                }}
                error={erroHodometro ?? undefined}
              />

              {/* Distância calculada em tempo real (Passo 3.1) */}
              {kmCalculado !== null && (
                <View style={styles.blocoCalculo}>
                  <Text variant="body" weight="medium">
                    {`Distância calculada: ${formatarKm(kmCalculado)}`}
                  </Text>
                </View>
              )}

              {/* Passo 3.3: Feedback visual na tela caso passe muito da estimativa */}
              {distanciaExcessiva && (
                <View style={styles.blocoAviso}>
                  <Badge
                    tone="danger"
                    label={`Atenção: ${formatarKm(kmCalculado)} rodados excede a estimativa da rota (${viagem.rota?.distancia_estimada_km} km).`}
                  />
                  <Text variant="caption" tone="body">
                    Revise o valor digitado no hodômetro antes de confirmar.
                  </Text>
                </View>
              )}
            </Column>
          </Card>

          {/* Único botão preenchido cyan da tela (DESIGN_CYAN §1) */}
          <Button
            label="Fechar viagem"
            variant="primary"
            loading={fechando}
            disabled={fechando}
            onPress={solicitarConfirmacao}
          />
        </Column>
      )}

      {/* Passo 3.2: Modal de Confirmação com o texto exigido "X km rodados, confirma?" */}
      <Modal
        visible={modalConfirmacaoAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalConfirmacaoAberto(false)}
      >
        <View style={styles.fundoModal}>
          <View style={styles.folhaModal}>
            <Column gap="md">
              <Text variant="subheading">Confirmar encerramento</Text>

              {/* Texto exigido: "X km rodados, confirma?" */}
              <Text variant="body" weight="medium">
                {`${kmCalculado ?? 0} km rodados, confirma?`}
              </Text>

              {distanciaExcessiva && (
                <Text variant="bodySm" tone="body">
                  Atenção: A distância percorrida é consideravelmente superior à distância estimada para esta rota.
                </Text>
              )}

              <View style={styles.botoesModal}>
                <Button
                  label="Cancelar"
                  variant="ghost"
                  onPress={() => setModalConfirmacaoAberto(false)}
                />
                <Button
                  label="Confirmar"
                  variant="primary"
                  loading={fechando}
                  onPress={executarFechamento}
                />
              </View>
            </Column>
          </View>
        </View>
      </Modal>
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
  },
  blocoCalculo: {
    paddingVertical: spacing.xs,
  },
  blocoAviso: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  fundoModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: `${colors.inverted}80`,
    padding: spacing.base,
  },
  folhaModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  botoesModal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
