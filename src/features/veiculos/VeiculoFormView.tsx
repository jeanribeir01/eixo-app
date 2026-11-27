import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { Button, Column, EmptyState, Input, Screen, Select, Skeleton, Snackbar, Text } from '@/ui';

import { formatarPlaca, normalizarPlaca } from './placa';
import { atualizarVeiculo, buscarVeiculoPorId, criarVeiculo } from './repository';
import { veiculoSchema } from './schema';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo } from './types';

type Campo = 'placa' | 'marca' | 'modelo' | 'ano_fabricacao' | 'capacidade_carga' | 'status';
type Erros = Partial<Record<Campo, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

const opcoesStatus = STATUS_VEICULO.filter((status) => status !== 'Inativo').map((status) => ({ label: rotuloStatusVeiculo[status], value: status }));

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
  const [anoFabricacao, setAnoFabricacao] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [statusVeiculo, setStatusVeiculo] = useState<StatusVeiculo>('Disponivel');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tentativa, setTentativa] = useState(0);

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
      setAnoFabricacao(resultado.data.ano_fabricacao === null ? '' : String(resultado.data.ano_fabricacao));
      setCapacidade(capacidadeParaTexto(resultado.data.capacidade_carga));
      setStatusVeiculo(resultado.data.status);
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [veiculoId, tentativa]);

  async function handleSalvar() {
    if (salvando) return;
    const resultado = veiculoSchema.safeParse({
      placa,
      marca,
      modelo,
      ano_fabricacao: anoFabricacao,
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
        ano_fabricacao: fieldErrors.ano_fabricacao?.[0],
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
      <Screen underHeader>
        {/* O formato do formulário aparece enquanto o veículo carrega: sem spinner no vazio. */}
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando veículo" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState title="Não foi possível carregar o veículo" description={erroCarga ?? undefined} actionLabel="Tentar novamente" onAction={() => setTentativa((atual) => atual + 1)} />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      underHeader
      scroll
      overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} duration={1200} onDismiss={handleFeedbackDismiss} />}
    >
      <Column gap="lg">
        {!modoEdicao && <Text tone="body">Cadastre o caminhão com a placa e os dados do documento.</Text>}

        <Column gap="md">
          <Input
            label="Placa"
            icone="frota"
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
          <Input
            label="Ano de fabricação"
            icone="calendario"
            placeholder="Ex.: 2020"
            value={anoFabricacao}
            onChangeText={setAnoFabricacao}
            keyboardType="number-pad"
            error={erros.ano_fabricacao}
          />
          <Input
            label="Capacidade de carga (toneladas)"
            placeholder="Ex.: 12,5"
            value={capacidade}
            onChangeText={setCapacidade}
            keyboardType="decimal-pad"
            error={erros.capacidade_carga}
          />

          {statusVeiculo === 'Inativo' ? (
            <Column gap="xs">
              <Text variant="bodySm" weight="medium">
                Status
              </Text>
              <Text>Inativo</Text>
            </Column>
          ) : (
            // Seletor em vez de abas: "Em Manutenção" cabia cortado numa fileira de três. O erro sai
            // igual ao dos outros campos (ícone, vermelho e alerta para o leitor de tela).
            <Select
              label="Status"
              value={statusVeiculo}
              options={opcoesStatus}
              onChange={(valor) => setStatusVeiculo(valor as StatusVeiculo)}
              error={erros.status}
            />
          )}
        </Column>

        {/* Um botão preenchido só por tela (DESIGN_CYAN §7); o rótulo diz o que o toque faz. */}
        <Column gap="sm">
          <Button label={modoEdicao ? 'Salvar alterações' : 'Cadastrar veículo'} onPress={handleSalvar} loading={salvando} />
          <Button label="Cancelar" variant="ghost" disabled={salvando} onPress={() => router.back()} />
        </Column>
      </Column>
    </Screen>
  );
}
