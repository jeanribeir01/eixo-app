import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { horaLocal } from '@/lib/datas';
import { trecho } from '@/lib/trecho';
import {
  Aviso,
  Button,
  Card,
  Column,
  EmptyState,
  FolhaDeConfirmacao,
  Input,
  Screen,
  Skeleton,
  Snackbar,
  Text,
  colors,
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
  // O estado `fechando` sozinho não barra um segundo toque em "Finalizar" antes do próximo render. O
  // ref é a guarda síncrona.
  const fechandoRef = useRef(false);
  // Hodômetro final já validado, esperando o "Finalizar" da folha de confirmação.
  const [aConfirmar, setAConfirmar] = useState<number | null>(null);

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

    // Passo 3.2: confirmação na folha do design system, com a distância já formatada.
    setAConfirmar(validacao.data.hodometro_final);
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
      setFeedback({ mensagem: 'Viagem finalizada.', tone: 'success' });
    } catch {
      setFeedback({
        mensagem: 'Não foi possível finalizar a viagem. Tente novamente.',
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
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando a viagem" />
          <Skeleton height="xxl" />
        </Column>
      ) : erroCarregamento || !viagem ? (
        <EmptyState
          icon="viagens"
          title="Não foi possível carregar a viagem"
          description={erroCarregamento ?? 'A viagem não está neste aparelho.'}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      ) : viagem.status !== 'EmAndamento' ? (
        <EmptyState
          icon="viagens"
          title="Esta viagem já foi encerrada"
          description={`Ela está como "${rotuloStatusViagem[viagem.status]}", então não há o que finalizar.`}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      ) : (
        <Column gap="lg">
          <ResumoDaViagem viagem={viagem} />

          <Column gap="xs">
            <Input
              label="Hodômetro final (km)"
              icone="hodometro"
              placeholder={`Maior que ${formatarHodometro(viagem.hodometro_inicial)}`}
              keyboardType="numeric"
              value={hodometroFinal}
              onChangeText={(texto) => {
                setHodometroFinal(texto);
                setErroHodometro(null);
              }}
              error={erroHodometro ?? undefined}
            />

            {/* Passo 3.1: a distância aparece enquanto o motorista digita, antes de confirmar. */}
            {kmCalculado !== null && !distanciaExcessiva && (
              <Text variant="bodySm" tone="body">
                {`${formatarKm(kmCalculado)} rodados nesta viagem.`}
              </Text>
            )}
          </Column>

          {/* Passo 3.3: muito acima da estimativa costuma ser dígito a mais. Aviso, não bloqueio: o
              painel pode mesmo mostrar esse valor (desvio, rota alternativa). */}
          {distanciaExcessiva && (
            <Aviso tom="warning" icone="alerta" titulo="Confira o hodômetro final">
              {`${formatarKm(kmCalculado)} rodados, bem acima dos ${viagem.rota?.distancia_estimada_km} km estimados para esta rota. Se o painel mostra esse valor, pode finalizar.`}
            </Aviso>
          )}

          {/* Um botão preenchido só por tela (DESIGN_CYAN §7). "Continuar viagem" volta sem salvar. */}
          <Column gap="sm">
            <Button
              label="Finalizar viagem"
              variant="primary"
              loading={fechando}
              disabled={fechando}
              onPress={solicitarConfirmacao}
            />
            <Button
              label="Continuar viagem"
              variant="ghost"
              disabled={fechando}
              onPress={() => router.back()}
            />
          </Column>
        </Column>
      )}

      {/* O botão diz a ação ("Finalizar"), não um "Confirmar" genérico. */}
      <FolhaDeConfirmacao
        visivel={aConfirmar !== null}
        titulo="Finalizar viagem?"
        mensagem={`${formatarKm(kmCalculado)} rodados nesta viagem.${
          distanciaExcessiva ? ' A distância está bem acima da estimada para esta rota.' : ''
        }`}
        rotuloConfirmar="Finalizar"
        onConfirmar={() => {
          const hodometroFinal = aConfirmar;
          setAConfirmar(null);
          if (hodometroFinal !== null) void executarFechamento(hodometroFinal);
        }}
        onCancelar={() => setAConfirmar(null)}
      />
    </Screen>
  );
}

// "João Silva · saída às 08:00": quem está com o caminhão e desde quando, no fuso do aparelho.
function quemEQuando(viagem: ViagemDetalhada): string | null {
  const partes = [viagem.motorista?.nome, viagem.data_inicio ? `saída às ${horaLocal(viagem.data_inicio)}` : null];
  const texto = partes.filter(Boolean).join(' · ');
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : null;
}

// O que o motorista precisa ver antes de digitar: qual caminhão, qual trecho e de onde o hodômetro partiu.
// Mesmo cartão de destaque do Início do Motorista, para a tela parecer a continuação dele.
function ResumoDaViagem({ viagem }: { viagem: ViagemDetalhada }) {
  const linhaDeQuem = quemEQuando(viagem);
  return (
    <Card variant="feature">
      <Text variant="bodySm" tone="body">
        Viagem em andamento
      </Text>
      <Column gap="xs">
        <Text variant="display" weight="semibold">
          {viagem.veiculo?.placa ?? 'Veículo'}
        </Text>
        {viagem.rota && (
          <Text tone="body">
            {trecho(viagem.rota)}
          </Text>
        )}
      </Column>
      <View style={styles.divisor} />
      {linhaDeQuem && (
        <Text variant="bodySm" tone="body">
          {linhaDeQuem}
        </Text>
      )}
      <Text variant="bodySm" tone="body">
        {`${viagem.veiculo?.modelo ? `${viagem.veiculo.modelo} · ` : ''}hodômetro na saída: ${formatarHodometro(viagem.hodometro_inicial)} km`}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  divisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
