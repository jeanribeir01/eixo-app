import { useState } from 'react';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { formatarPlaca } from '@/features/veiculos/placa';
import { listarVeiculosSelecionaveis } from '@/features/veiculos/repository';
import { useCargaUnica } from '@/lib/useCargaUnica';
import type { Resultado } from '@/lib/useDadosDaTela';
import { Aviso, Button, CampoData, CampoMoeda, Column, EmptyState, Input, Screen, Select, Skeleton, Snackbar, Tabs, Text } from '@/ui';

import { listarFormasPagamentoAtivas, registrarManutencao } from './manutencaoRepository';
import { manutencaoSchema, valoresIniciais, type ManutencaoFormValues } from './schema';
import type { FormaPagamentoOpcao, StatusPagamento, VeiculoResumo } from './types';

type Erros = Partial<Record<keyof ManutencaoFormValues, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type Opcoes = { veiculos: VeiculoResumo[]; formas: FormaPagamentoOpcao[] };

const opcoesStatus: { value: StatusPagamento; label: string }[] = [
  { value: 'Pendente', label: 'Pendente' },
  { value: 'Pago', label: 'Pago' },
];

// Contrato da EIX-79: só Disponível e Em Manutenção. Veículo em viagem nem aparece; o MN001 da RPC fica
// para a corrida em que a viagem abre depois de a lista carregar.
async function buscarOpcoes(): Promise<Resultado<Opcoes>> {
  const [resultadoVeiculos, resultadoFormas] = await Promise.all([
    listarVeiculosSelecionaveis('manutencao'),
    listarFormasPagamentoAtivas(),
  ]);
  if (!resultadoVeiculos.ok) return resultadoVeiculos;
  if (!resultadoFormas.ok) return resultadoFormas;
  return { ok: true, data: { veiculos: resultadoVeiculos.data, formas: resultadoFormas.data } };
}

export function ManutencaoFormView() {
  const router = useRouter();

  const [opcoes, setOpcoes] = useState<Opcoes>({ veiculos: [], formas: [] });
  // Data de hoje e status Pendente já preenchidos (calculados quando a tela abre).
  const [valores, setValores] = useState<ManutencaoFormValues>(valoresIniciais);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Carga única das opções (useCargaUnica): sem internet a tela diz isso na hora e tenta de novo
  // sozinha quando a conexão volta.
  const { status, erro: erroCarga, tentarDeNovo } = useCargaUnica(buscarOpcoes, setOpcoes);

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

    if (!resposta.ok) {
      setSalvando(false);
      // Recusa do banco (veículo em viagem, forma inativa...) já vem traduzida pelo repositório.
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    // O botão continua em loading até a tela fechar, como em Dívidas: o banco aceita duas ordens
    // abertas no mesmo veículo, então um segundo toque gravaria outra manutenção e outra despesa.
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
      <Screen underHeader>
        {/* O formato do formulário aparece enquanto veículos e formas carregam: sem spinner no vazio. */}
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando formulário" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
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
          onAction={tentarDeNovo}
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
      <Column gap="lg">
        <Text tone="body">Registre o serviço feito no caminhão.</Text>

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
          <Input
            label="Descrição do serviço"
            icone="manutencoes"
            placeholder="Ex.: Troca de pneus"
            value={valores.descricao}
            onChangeText={(texto) => alterar('descricao', texto)}
            maxLength={100}
            error={erros.descricao}
          />
          <CampoMoeda
            label="Valor total"
            valorCentavos={valores.valorCentavos}
            onChange={(centavos) => alterar('valorCentavos', centavos)}
            error={erros.valorCentavos}
          />
          <CampoData
            label="Data da manutenção"
            value={valores.dataManutencao}
            onChange={(texto) => alterar('dataManutencao', texto)}
            error={erros.dataManutencao}
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
            <Text variant="bodySm" weight="medium">
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

        {/* A RPC faz duas coisas que a pessoa não vê nesta tela (US06-b): avisa antes, não só no Snackbar. */}
        <Aviso tom="info" icone="manutencoes" titulo="Manutenção e despesa juntas">
          Ao registrar, o valor entra no caixa como despesa de Manutenção e o veículo fica em manutenção até o
          serviço ser concluído.
        </Aviso>

        {/* Um botão preenchido só por tela (DESIGN_CYAN §7); o rótulo diz o que o toque faz. */}
        <Column gap="sm">
          <Button label="Registrar manutenção" onPress={handleSalvar} loading={salvando} />
          <Button label="Cancelar" variant="ghost" disabled={salvando} onPress={() => router.back()} />
        </Column>
      </Column>
    </Screen>
  );
}
