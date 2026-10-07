import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { CampoData } from '@/features/movimentacoes/components/CampoData';
import { CampoMoeda } from '@/features/movimentacoes/components/CampoMoeda';
import { listarOpcoesMovimentacao, type OpcoesMovimentacao } from '@/features/movimentacoes/movimentacoesRepository';
import { formatarMoeda } from '@/lib/money';
import { Button, Column, EmptyState, Input, Screen, Select, Snackbar, colors } from '@/ui';

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
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando formulário" />
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
      <Column gap="md">
        <Input
          label="Descrição"
          placeholder="Ex.: Financiamento do caminhão"
          value={valores.descricao}
          onChangeText={(texto) => alterar('descricao', texto)}
          maxLength={120}
          error={erros.descricao}
        />
        <Input
          label="Quantidade de parcelas"
          placeholder={`De 1 a ${MAXIMO_PARCELAS}`}
          keyboardType="number-pad"
          // Só dígitos: campo vazio vira 0, e o schema avisa "Informe ao menos 1 parcela."
          value={valores.quantidadeParcelas === 0 ? '' : String(valores.quantidadeParcelas)}
          onChangeText={(texto) => alterar('quantidadeParcelas', Number(texto.replace(/\D/g, '')))}
          maxLength={3}
          error={erros.quantidadeParcelas}
        />
        <CampoMoeda
          label="Valor da parcela (R$)"
          valorCentavos={valores.valorParcelaCentavos}
          onChange={(centavos) => alterar('valorParcelaCentavos', centavos)}
          error={erros.valorParcelaCentavos}
        />
        {/* Somente leitura (AC): quantidade × valor da parcela, atualizado enquanto o usuário digita. */}
        <Input label="Soma total" value={formatarMoeda(somaTotal)} editable={false} />
        <CampoData
          label="Vencimento da 1ª parcela"
          value={valores.dataVencimentoPrimeira}
          onChange={(texto) => alterar('dataVencimentoPrimeira', texto)}
          error={erros.dataVencimentoPrimeira}
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

      <Button label="Salvar" onPress={handleSalvar} loading={salvando} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
