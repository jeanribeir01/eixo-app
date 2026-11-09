import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { z } from 'zod';

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
  spacing,
} from '@/ui';

import {
  calcularKmRodado,
  distanciaUltrapassaEstimativa,
  formatarHodometro,
  formatarKm,
  parseHodometro,
} from './calculo';
import { fecharViagemFormSchema } from './schema';
import { rotuloStatusViagem, type ViagemDetalhada } from './types';
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
  const [fechando, setFechando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // O Alert guarda a closure do primeiro render; o estado `fechando` sozinho não barra um
  // segundo toque em "Confirmar" antes do próximo render. O ref é a guarda síncrona.
  const fechandoRef = useRef(false);

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

  const valorFinalNum = parseHodometro(hodometroFinal);
  const hodometroInicial = viagem?.hodometro_inicial ?? 0;

  // Passo 3.1: Cálculo Offline da quilometragem
  const kmCalculado =
    valorFinalNum !== null && valorFinalNum > hodometroInicial
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
    const validacao = fecharViagemFormSchema.safeParse({
      hodometro_inicial: hodometroInicial,
      hodometro_final: valorFinalNum ?? Number.NaN,
    });

    if (!validacao.success) {
      // As mensagens vêm do schema; a tela não repete texto de validação.
      const fieldErrors = z.flattenError(validacao.error).fieldErrors;
      setErroHodometro(fieldErrors.hodometro_final?.[0] ?? 'Hodômetro final inválido.');
      return;
    }

    setErroHodometro(null);

    // Passo 3.2: confirmação no Alert padrão do sistema, com a distância já formatada.
    const mensagem = `${formatarKm(kmCalculado)} rodados, confirma?`;
    const aviso = distanciaExcessiva
      ? '\n\nAtenção: a distância percorrida é consideravelmente superior à distância estimada para esta rota.'
      : '';

    Alert.alert('Confirmar encerramento', `${mensagem}${aviso}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => executarFechamento(validacao.data.hodometro_final) },
    ]);
  }

  async function executarFechamento(hodometroFinalValidado: number) {
    if (fechandoRef.current) return;

    fechandoRef.current = true;
    setFechando(true);
    let sucesso = false;

    try {
      // REGRA CRÍTICA: km_rodado NUNCA é enviado no update
      const resultado = await fecharViagem(viagemId, {
        hodometro_final: hodometroFinalValidado,
      });

      if (!resultado.ok) {
        if (resultado.campo === 'hodometro_final') {
          setErroHodometro(resultado.mensagem);
        }
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }

      // O botão segue em loading até a tela fechar: sem setTimeout, o toque repetido durante a
      // mensagem de sucesso não fecha a viagem duas vezes.
      sucesso = true;
      setFeedback({ mensagem: 'Viagem concluída com sucesso!', tone: 'success' });
    } catch {
      setFeedback({
        mensagem: 'Não foi possível fechar a viagem. Tente novamente.',
        tone: 'error',
      });
    } finally {
      // Sucesso mantém o loading até o Snackbar navegar de volta; falha e exceção reabilitam.
      if (!sucesso) {
        fechandoRef.current = false;
        setFechando(false);
      }
    }
  }

  function dispensarFeedback() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  return (
    <Screen
      scroll
      underHeader
      overlay={
        feedback ? (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={dispensarFeedback} />
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
          description={`Esta viagem está com o status "${rotuloStatusViagem[viagem.status]}" e não pode ser fechada novamente.`}
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
                <Badge label={rotuloStatusViagem.EmAndamento} tone="neutral" />
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
                  {/* Verde/vermelho são exclusivos de valor financeiro; o texto já avisa do desvio. */}
                  <Badge
                    tone="neutral"
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
});
