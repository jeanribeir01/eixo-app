import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { listarOpcoesMovimentacao, type OpcoesMovimentacao } from '@/features/movimentacoes/movimentacoesRepository';
import { formatarMoeda } from '@/lib/money';
import { Button, CampoData, CampoMoeda, Card, Column, EmptyState, Input, Screen, Select, Skeleton, Snackbar, Text } from '@/ui';

import { criarDivida } from '../dividasRepository';
import { MAXIMO_PARCELAS, dividaSchema, somaTotalCentavos, type DividaFormValues } from '../schema';

type Erros = Partial<Record<keyof DividaFormValues, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

// Sugestões da task (EIX-50): quem financia um caminhão quase sempre paga em boleto.
const CATEGORIA_SUGERIDA = 'Financiamento';
const FORMA_SUGERIDA = 'Boleto';

const VALORES_INICIAIS: DividaFormValues = {
  descricao: '',
  quantidadeParcelas: 1,
  valorParcelaCentavos: 0,
  dataVencimentoPrimeira: '',
  categoriaId: null,
  formaPagamentoId: null,
  valorQuitacaoCentavos: null,
};

const CAMPOS: (keyof DividaFormValues)[] = [
  'descricao',
  'quantidadeParcelas',
  'valorParcelaCentavos',
  'dataVencimentoPrimeira',
  'categoriaId',
  'formaPagamentoId',
  'valorQuitacaoCentavos',
];

function mensagemDeSucesso(quantidadeParcelas: number): string {
  return quantidadeParcelas === 1 ? '1 parcela gerada.' : `${quantidadeParcelas} parcelas geradas.`;
}

export function DividaFormView() {
  const router = useRouter();

  const [status, setStatus] = useState<StatusCarga>('carregando');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesMovimentacao>({ categorias: [], formasPagamento: [] });
  const [valores, setValores] = useState<DividaFormValues>(VALORES_INICIAIS);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelado = false;

    listarOpcoesMovimentacao().then((resultado) => {
      if (cancelado) return;
      if (!resultado.ok) {
        setErroCarga(resultado.mensagem);
        setStatus('erro');
        return;
      }

      // Parcela de dívida é sempre saída do caixa: só categorias de Saída (as inativas já vêm fora).
      const categorias = resultado.data.categorias.filter((categoria) => categoria.tipo === 'Saida');
      const { formasPagamento } = resultado.data;
      setOpcoes({ categorias, formasPagamento });
      setValores((atuais) => ({
        ...atuais,
        categoriaId: categorias.find((categoria) => categoria.titulo === CATEGORIA_SUGERIDA)?.id ?? null,
        formaPagamentoId: formasPagamento.find((forma) => forma.nome === FORMA_SUGERIDA)?.id ?? null,
      }));
      setStatus('pronto');
    });

    return () => {
      cancelado = true;
    };
  }, []);

  function alterar<K extends keyof DividaFormValues>(nome: K, valor: DividaFormValues[K]) {
    setValores((atuais) => ({ ...atuais, [nome]: valor }));
  }

  async function handleSalvar() {
    if (salvando) return;

    const resultado = dividaSchema.safeParse(valores);
    if (!resultado.success) {
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      const novosErros: Erros = {};
      for (const campo of CAMPOS) {
        novosErros[campo] = fieldErrors[campo]?.[0];
      }
      setErros(novosErros);
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = await criarDivida(resultado.data);

    if (!resposta.ok) {
      setSalvando(false);
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    // O botão continua em loading até a tela fechar: um segundo toque criaria a dívida de novo,
    // com todas as parcelas em dobro no caixa.
    setFeedback({ mensagem: mensagemDeSucesso(resposta.data.quantidadeParcelas), tone: 'success' });
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  if (status === 'carregando') {
    return (
      <Screen underHeader>
        {/* O formato do formulário aparece enquanto as opções carregam: sem spinner no vazio. */}
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
        <EmptyState title={erroCarga ?? 'Não foi possível carregar.'} actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  const somaTotal = somaTotalCentavos(valores.quantidadeParcelas, valores.valorParcelaCentavos);

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
        <Text tone="body">Crie todas as parcelas de uma vez. Cada uma vira uma saída pendente no caixa.</Text>

        <Column gap="md">
          <Input
            label="Descrição"
            placeholder="Ex.: Financiamento do caminhão"
            value={valores.descricao}
            onChangeText={(texto) => alterar('descricao', texto)}
            maxLength={120}
            error={erros.descricao}
          />
          <Select
            label="Categoria"
            value={valores.categoriaId}
            options={opcoes.categorias.map((categoria) => ({ value: categoria.id, label: categoria.titulo }))}
            onChange={(id) => alterar('categoriaId', id)}
            placeholder="Escolha a categoria"
            emptyMessage="Nenhuma categoria de saída ativa."
            error={erros.categoriaId}
          />
          <Column gap="xs">
            <Input
              label="Quantidade de parcelas"
              placeholder="Ex.: 12"
              keyboardType="number-pad"
              // Só dígitos: campo vazio vira 0, e o schema avisa "Informe ao menos 1 parcela."
              value={valores.quantidadeParcelas === 0 ? '' : String(valores.quantidadeParcelas)}
              onChangeText={(texto) => alterar('quantidadeParcelas', Number(texto.replace(/\D/g, '')))}
              maxLength={3}
              error={erros.quantidadeParcelas}
            />
            {!erros.quantidadeParcelas && (
              <Text variant="caption" tone="body">{`De 1 a ${MAXIMO_PARCELAS} parcelas.`}</Text>
            )}
          </Column>
          <CampoMoeda
            label="Valor por parcela"
            valorCentavos={valores.valorParcelaCentavos}
            onChange={(centavos) => alterar('valorParcelaCentavos', centavos)}
            error={erros.valorParcelaCentavos}
          />
          <CampoData
            label="Primeiro vencimento"
            value={valores.dataVencimentoPrimeira}
            onChange={(texto) => alterar('dataVencimentoPrimeira', texto)}
            error={erros.dataVencimentoPrimeira}
          />
          <Select
            label="Forma de pagamento"
            value={valores.formaPagamentoId}
            options={opcoes.formasPagamento.map((forma) => ({ value: forma.id, label: forma.nome }))}
            onChange={(id) => alterar('formaPagamentoId', id)}
            placeholder="Escolha a forma de pagamento"
            emptyMessage="Nenhuma forma de pagamento ativa."
            error={erros.formaPagamentoId}
          />
          <CampoMoeda
            label="Valor de quitação antecipada (opcional)"
            valorCentavos={valores.valorQuitacaoCentavos ?? 0}
            // Campo vazio = sem quitação (null), não quitação de R$ 0,00.
            onChange={(centavos) => alterar('valorQuitacaoCentavos', centavos === 0 ? null : centavos)}
            error={erros.valorQuitacaoCentavos}
          />
        </Column>

        {/* Somente leitura (AC da EIX-50): quantidade × valor da parcela, atualizado enquanto a pessoa digita.
            Fica antes do botão para ela conferir o total antes de gerar as parcelas. */}
        <Card>
          <Text variant="bodySm" tone="body">
            Resumo do parcelamento
          </Text>
          <Text variant="subheading" weight="semibold">
            {`${valores.quantidadeParcelas} × ${formatarMoeda(valores.valorParcelaCentavos)}`}
          </Text>
          <Text tone="body">{`Soma total: ${formatarMoeda(somaTotal)}`}</Text>
        </Card>

        {/* Um botão preenchido só por tela (DESIGN_CYAN §7). O rótulo diz o que o toque faz: cria tudo de uma vez. */}
        <Column gap="sm">
          <Button label="Criar dívida e parcelas" onPress={handleSalvar} loading={salvando} />
          <Button label="Cancelar" variant="ghost" disabled={salvando} onPress={() => router.back()} />
        </Column>
      </Column>
    </Screen>
  );
}
