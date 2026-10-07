import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { CampoData } from '@/features/movimentacoes/components/CampoData';
import { CampoMoeda } from '@/features/movimentacoes/components/CampoMoeda';
import { listarOpcoesMovimentacao, type OpcoesMovimentacao } from '@/features/movimentacoes/movimentacoesRepository';
import { Button, Column, Input, Screen, Select, Snackbar, Text, colors, radius, spacing } from '@/ui';
import { formatarMoeda } from '@/lib/money';

import { criarDivida } from '../dividasRepository';
import { dividaSchema, somaTotalCentavos, type DividaFormValues } from '../schema';

type Erros = Partial<Record<keyof DividaFormValues, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

const VALORES_INICIAIS: DividaFormValues = {
  descricao: '',
  quantidadeParcelas: 1,
  valorParcelaCentavos: 0,
  dataVencimentoPrimeira: '',
  categoriaId: null,
  formaPagamentoId: null,
  valorQuitacaoCentavos: null,
};

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

    async function carregar() {
      const resultado = await listarOpcoesMovimentacao();
      if (cancelado) return;

      if (!resultado.ok) {
        setErroCarga(resultado.mensagem);
        setStatus('erro');
        return;
      }

      const categorias = resultado.data.categorias.filter((c) => c.ativa && c.tipo === 'Saida');
      const formasPagamento = resultado.data.formasPagamento.filter((f) => f.ativa);

      const financiamento = categorias.find((c) => c.titulo === 'Financiamento');
      const boleto = formasPagamento.find((f) => f.nome === 'Boleto');

      setOpcoes({ categorias, formasPagamento });
      setValores((v) => ({
        ...v,
        categoriaId: financiamento?.id ?? null,
        formaPagamentoId: boleto?.id ?? null,
      }));
      setStatus('pronto');
    }

    carregar();
    return () => { cancelado = true; };
  }, []);

  if (status === 'carregando') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <Column align="center" gap="lg">
            <Text variant="subheading" tone="primary" style={{ textAlign: 'center' }}>Não foi possível carregar</Text>
            <Text variant="body" tone="body" style={{ textAlign: 'center' }}>{erroCarga}</Text>
            <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
          </Column>
        </View>
      </Screen>
    );
  }

  async function salvar() {
    setErros({});
    setFeedback(null);

    const parsed = dividaSchema.safeParse(valores);
    if (!parsed.success) {
      const novosErros: Erros = {};
      for (const erro of parsed.error.issues) {
        const path = erro.path[0] as keyof DividaFormValues;
        if (!novosErros[path]) novosErros[path] = erro.message;
      }
      setErros(novosErros);
      return;
    }

    setSalvando(true);
    const resultado = await criarDivida(parsed.data);
    setSalvando(false);

    if (resultado.ok) {
      setFeedback({ mensagem: `${resultado.data.quantidadeParcelas} parcelas geradas`, tone: 'success' });
      setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/dividas');
      }, 1500);
    } else {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
    }
  }

  const opcoesCategoria = opcoes.categorias.map((c) => ({ label: c.titulo, value: c.id }));
  const opcoesForma = opcoes.formasPagamento.map((f) => ({ label: f.nome, value: f.id }));
  const totalSoma = somaTotalCentavos(valores.quantidadeParcelas, valores.valorParcelaCentavos);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 100 }}>
        <Column gap="lg">
          <Input
            label="Descrição"
            value={valores.descricao}
            placeholder="Ex: Financiamento do Caminhão"
            onChangeText={(texto) => setValores({ ...valores, descricao: texto })}
            error={erros.descricao}
          />

          <Input
            label="Quantidade de Parcelas"
            value={valores.quantidadeParcelas ? String(valores.quantidadeParcelas) : ''}
            keyboardType="number-pad"
            placeholder="Ex: 48"
            onChangeText={(texto) => {
              const num = parseInt(texto.replace(/\D/g, ''), 10);
              setValores({ ...valores, quantidadeParcelas: isNaN(num) ? 0 : num });
            }}
            error={erros.quantidadeParcelas}
          />

          <CampoMoeda
            label="Valor da Parcela"
            valorCentavos={valores.valorParcelaCentavos}
            onChange={(val) => setValores({ ...valores, valorParcelaCentavos: val })}
            error={erros.valorParcelaCentavos}
          />

          <CampoData
            label="Data de Vencimento da 1ª Parcela"
            value={valores.dataVencimentoPrimeira}
            onChange={(texto) => setValores({ ...valores, dataVencimentoPrimeira: texto })}
            error={erros.dataVencimentoPrimeira}
          />

          <Select
            label="Categoria"
            options={opcoesCategoria}
            value={valores.categoriaId}
            onChange={(val) => setValores({ ...valores, categoriaId: val })}
            error={erros.categoriaId}
            placeholder="Selecione uma categoria"
          />

          <Select
            label="Forma de Pagamento"
            options={opcoesForma}
            value={valores.formaPagamentoId}
            onChange={(val) => setValores({ ...valores, formaPagamentoId: val })}
            error={erros.formaPagamentoId}
            placeholder="Selecione uma forma de pagamento"
          />

          <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.input, padding: spacing.md }}>
            <Column gap="xs">
              <Text variant="caption" tone="body" weight="medium">Soma Total</Text>
              <Text variant="body" tone="primary" weight="medium">{formatarMoeda(totalSoma)}</Text>
            </Column>
          </View>

          <CampoMoeda
            label="Valor de Quitação Antecipada (opcional)"
            valorCentavos={valores.valorQuitacaoCentavos ?? 0}
            onChange={(val) => setValores({ ...valores, valorQuitacaoCentavos: val === 0 ? null : val })}
            error={erros.valorQuitacaoCentavos}
          />

          <Button
            label="Salvar"
            variant="primary"
            onPress={salvar}
            loading={salvando}
          />
        </Column>
      </ScrollView>

      {feedback && (
        <Snackbar
          message={feedback.mensagem}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      )}
    </Screen>
  );
}
