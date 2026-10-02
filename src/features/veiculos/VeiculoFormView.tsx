import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { Button, Column, EmptyState, Input, Screen, Snackbar, Tabs, Text, colors } from '@/ui';

import { formatarPlaca, normalizarPlaca } from './placa';
import { atualizarVeiculo, buscarVeiculoPorId, criarVeiculo } from './repository';
import { veiculoSchema } from './schema';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo } from './types';

type Campo = 'placa' | 'marca' | 'modelo' | 'capacidade_carga' | 'status';
type Erros = Partial<Record<Campo, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

const opcoesStatus = STATUS_VEICULO.map((status) => ({ label: rotuloStatusVeiculo[status], value: status }));

// Placa tem 7 caracteres nos dois formatos; o hífen da antiga é o 8º, só visual.
const TAMANHO_PLACA = 7;

// Máscara enquanto digita: normaliza (maiúscula, sem hífen/espaço) e reaplica o hífen só quando a
// placa está completa no formato antigo (AAA-1234). Mercosul (AAA1A23) nunca leva hífen.
function mascararPlaca(texto: string): string {
  return formatarPlaca(normalizarPlaca(texto).slice(0, TAMANHO_PLACA));
}

// O número vem do banco com ponto; na tela o usuário lê e digita com vírgula.
function capacidadeParaTexto(toneladas: number): string {
  return String(toneladas).replace('.', ',');
}

export type VeiculoFormViewProps = {
  // Sem id: modo criar. Com id: modo editar, carrega o veículo antes de mostrar o formulário.
  veiculoId?: string;
};

export function VeiculoFormView({ veiculoId }: VeiculoFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!veiculoId;

  const [status, setStatus] = useState<StatusCarga>(modoEdicao ? 'carregando' : 'pronto');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [statusVeiculo, setStatusVeiculo] = useState<StatusVeiculo>('Disponivel');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!veiculoId) return;
    const id = veiculoId;
    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const resultado = await buscarVeiculoPorId(id);
      if (cancelado) return;

      if (!resultado.ok) {
        setErroCarga(resultado.mensagem);
        setStatus('erro');
        return;
      }

      setPlaca(formatarPlaca(resultado.data.placa));
      setMarca(resultado.data.marca);
      setModelo(resultado.data.modelo);
      setCapacidade(capacidadeParaTexto(resultado.data.capacidade_carga));
      setStatusVeiculo(resultado.data.status);
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [veiculoId]);

  async function handleSalvar() {
    const resultado = veiculoSchema.safeParse({
      placa,
      marca,
      modelo,
      capacidade_carga: capacidade,
      status: statusVeiculo,
    });
    if (!resultado.success) {
      // Um erro por campo: a mensagem aparece junto do campo que falhou.
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({
        placa: fieldErrors.placa?.[0],
        marca: fieldErrors.marca?.[0],
        modelo: fieldErrors.modelo?.[0],
        capacidade_carga: fieldErrors.capacidade_carga?.[0],
        status: fieldErrors.status?.[0],
      });
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = veiculoId ? await atualizarVeiculo(veiculoId, resultado.data) : await criarVeiculo(resultado.data);
    setSalvando(false);

    if (!resposta.ok) {
      // Placa duplicada é uma validação, não um erro de rede: aparece junto do campo Placa também.
      if (resposta.campo) setErros({ [resposta.campo]: resposta.mensagem });
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setFeedback({
      mensagem: veiculoId ? 'Veículo atualizado.' : 'Veículo cadastrado.',
      tone: 'success',
    });
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  if (status === 'carregando') {
    return (
      <Screen align="center">
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando veículo" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center">
        <EmptyState title="Não foi possível carregar o veículo" description={erroCarga ?? undefined} actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Column gap="xs">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">{modoEdicao ? 'Editar veículo' : 'Novo veículo'}</Text>
      </Column>

      <Column gap="md">
        <Input
          label="Placa"
          placeholder="AAA-1234 ou AAA1A23"
          value={placa}
          onChangeText={(texto) => setPlaca(mascararPlaca(texto))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={TAMANHO_PLACA + 1}
          error={erros.placa}
        />
        <Input label="Marca" placeholder="Ex.: Volvo" value={marca} onChangeText={setMarca} error={erros.marca} />
        <Input label="Modelo" placeholder="Ex.: FH 540" value={modelo} onChangeText={setModelo} error={erros.modelo} />
        {/* TODO(EIX-37): campo "Ano de Fabricação" (1950 até ano atual + 1) depende de uma migration
            que ainda não existe — a tabela `veiculo` não tem a coluna `ano_fabricacao`. */}
        <Input
          label="Capacidade de carga (toneladas)"
          placeholder="Ex.: 12,5"
          value={capacidade}
          onChangeText={setCapacidade}
          keyboardType="decimal-pad"
          error={erros.capacidade_carga}
        />

        <Column gap="xs">
          <Text variant="bodySm" tone="body" weight="medium">
            Status
          </Text>
          {/* TODO(EIX-37): "Inativo" depende da migration que adiciona o valor ao enum status_veiculo. */}
          <Tabs
            options={opcoesStatus}
            value={statusVeiculo}
            onChange={(valor) => setStatusVeiculo(valor as StatusVeiculo)}
            accessibilityLabel="Status do veículo"
          />
          {!!erros.status && (
            <Text accessibilityRole="alert" variant="bodySm">
              {erros.status}
            </Text>
          )}
        </Column>
      </Column>

      <Button label="Salvar" onPress={handleSalvar} loading={salvando} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />

      {feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} duration={1200} onDismiss={handleFeedbackDismiss} />}
    </Screen>
  );
}
