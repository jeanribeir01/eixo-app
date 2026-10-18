import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { formatarPlaca } from '@/features/veiculos/placa';
import { Button, CampoData, CampoMoeda, Column, EmptyState, Input, Screen, Select, Snackbar, Tabs, Text, colors } from '@/ui';

import { listarFormasPagamentoAtivas, listarVeiculosSelecionaveis, registrarManutencao } from './manutencaoRepository';
import { manutencaoSchema, valoresIniciais, type ManutencaoFormValues } from './schema';
import type { FormaPagamentoOpcao, StatusPagamento, VeiculoResumo } from './types';

type Erros = Partial<Record<keyof ManutencaoFormValues, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';
type Opcoes = { veiculos: VeiculoResumo[]; formas: FormaPagamentoOpcao[] };

const opcoesStatus: { value: StatusPagamento; label: string }[] = [
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Pago', label: 'Pago' },
];

export function ManutencaoFormView() {
  const router = useRouter();

  const [status, setStatus] = useState<StatusCarga>('carregando');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  // Muda a cada "Tentar novamente": o efeito de carga roda de novo.
  const [tentativa, setTentativa] = useState(0);
  const [opcoes, setOpcoes] = useState<Opcoes>({ veiculos: [], formas: [] });
  // Data de hoje e status Pendente já preenchidos (calculados quando a tela abre).
  const [valores, setValores] = useState<ManutencaoFormValues>(valoresIniciais);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const [resultadoVeiculos, resultadoFormas] = await Promise.all([
        listarVeiculosSelecionaveis(),
        listarFormasPagamentoAtivas(),
      ]);
      if (cancelado) return;

      const falha = !resultadoVeiculos.ok ? resultadoVeiculos : !resultadoFormas.ok ? resultadoFormas : null;
      if (falha) {
        setErroCarga(falha.mensagem);
        setStatus('erro');
        return;
      }

      if (resultadoVeiculos.ok && resultadoFormas.ok) {
        setOpcoes({ veiculos: resultadoVeiculos.data, formas: resultadoFormas.data });
      }
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  function alterar<K extends keyof ManutencaoFormValues>(nome: K, valor: ManutencaoFormValues[K]) {
    setValores((atuais) => ({ ...atuais, [nome]: valor }));
  }

  async function handleSalvar() {
    if (salvando) return;

    const resultado = manutencaoSchema.safeParse(valores);
    if (!resultado.success) {
      // Um erro por campo: a mensagem aparece junto do campo que falhou.
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({
        veiculoId: fieldErrors.veiculoId?.[0],
        dataManutencao: fieldErrors.dataManutencao?.[0],
        descricao: fieldErrors.descricao?.[0],
        valorCentavos: fieldErrors.valorCentavos?.[0],
        formaPagamentoId: fieldErrors.formaPagamentoId?.[0],
        statusPagamento: fieldErrors.statusPagamento?.[0],
      });
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = await registrarManutencao(resultado.data);
    setSalvando(false);

    if (!resposta.ok) {
      // Recusa do banco (veículo em viagem, forma inativa...) já vem traduzida pelo repositório.
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    // A RPC já parou o veículo e lançou a despesa: o texto avisa as duas coisas que o usuário não vê.
    setFeedback({ mensagem: 'Manutenção registrada. O veículo está em manutenção.', tone: 'success' });
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  if (status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando formulário" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar"
          description={erroCarga ?? undefined}
          actionLabel="Tentar novamente"
          onAction={() => setTentativa((atual) => atual + 1)}
        />
      </Screen>
    );
  }

  return (
    // Formulário longo: o Screen rola em celular pequeno (RNF02) e sobe com o teclado.
    <Screen
      underHeader
      scroll
      overlay={
        feedback && (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} duration={1200} onDismiss={handleFeedbackDismiss} />
        )
      }
    >
      <Column gap="md">
        <Select
          label="Veículo"
          value={valores.veiculoId}
          options={opcoes.veiculos.map((veiculo) => ({
            value: veiculo.id,
            label: `${formatarPlaca(veiculo.placa)} · ${veiculo.marca} ${veiculo.modelo}`,
          }))}
          onChange={(id) => alterar('veiculoId', id)}
          placeholder="Escolha o veículo"
          error={erros.veiculoId}
        />
        <CampoData
          label="Data da manutenção"
          value={valores.dataManutencao}
          onChange={(texto) => alterar('dataManutencao', texto)}
          error={erros.dataManutencao}
        />
        <Input
          label="Descrição do serviço"
          placeholder="Ex.: Troca de pneus"
          value={valores.descricao}
          onChangeText={(texto) => alterar('descricao', texto)}
          maxLength={200}
          error={erros.descricao}
        />
        <CampoMoeda
          label="Valor total"
          valorCentavos={valores.valorCentavos}
          onChange={(centavos) => alterar('valorCentavos', centavos)}
          error={erros.valorCentavos}
        />
        <Select
          label="Forma de pagamento"
          value={valores.formaPagamentoId}
          options={opcoes.formas.map((forma) => ({ value: forma.id, label: forma.nome }))}
          onChange={(id) => alterar('formaPagamentoId', id)}
          placeholder="Escolha a forma de pagamento"
          emptyMessage="Nenhuma forma de pagamento ativa."
          error={erros.formaPagamentoId}
        />
        <Column gap="xs">
          <Text variant="bodySm" tone="body" weight="medium">
            Status do pagamento
          </Text>
          <Tabs
            accessibilityLabel="Status do pagamento"
            options={opcoesStatus}
            value={valores.statusPagamento}
            onChange={(opcao) => alterar('statusPagamento', opcao as StatusPagamento)}
          />
        </Column>
      </Column>

      <Button label="Salvar" onPress={handleSalvar} loading={salvando} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
