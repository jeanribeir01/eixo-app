import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { Button, Column, EmptyState, Input, Screen, Snackbar, Text, colors } from '@/ui';

import { atualizarFormaPagamento, buscarFormaPagamentoPorId, criarFormaPagamento } from './formasPagamentoRepository';
import { formaPagamentoSchema } from './schema';
import { isFormaFixa } from './types';

type Erros = Partial<Record<'nome', string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

export type FormaPagamentoFormViewProps = {
  formaPagamentoId?: string;
};

export function FormaPagamentoFormView({ formaPagamentoId }: FormaPagamentoFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!formaPagamentoId;

  const [status, setStatus] = useState<StatusCarga>(modoEdicao ? 'carregando' : 'pronto');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [nomeOriginal, setNomeOriginal] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!formaPagamentoId) return;

    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const resultado = await buscarFormaPagamentoPorId(formaPagamentoId!);
      if (cancelado) return;

      if (!resultado.ok) {
        setErroCarga(resultado.mensagem);
        setStatus('erro');
        return;
      }

      setNome(resultado.data.nome);
      setNomeOriginal(resultado.data.nome);
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [formaPagamentoId]);

  async function handleSalvar() {
    const resultado = formaPagamentoSchema.safeParse({ nome });
    if (!resultado.success) {
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({ nome: fieldErrors.nome?.[0] });
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = formaPagamentoId
      ? await atualizarFormaPagamento(formaPagamentoId, resultado.data)
      : await criarFormaPagamento(resultado.data);
    setSalvando(false);

    if (!resposta.ok) {
      setErros({ nome: resposta.mensagem });
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setFeedback({
      mensagem: formaPagamentoId ? 'Forma de pagamento atualizada.' : 'Forma de pagamento criada.',
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
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando forma de pagamento" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState title="Não foi possível carregar a forma de pagamento" description={erroCarga ?? undefined} actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  const isFixo = isFormaFixa(nomeOriginal);

  return (
    <Screen
      underHeader
      scroll
      overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} duration={1200} onDismiss={handleFeedbackDismiss} />}
    >
      <Column gap="md">
        <Input 
          label="Nome" 
          placeholder="Ex.: Dinheiro" 
          value={nome} 
          onChangeText={setNome} 
          error={erros.nome} 
          editable={!isFixo}
        />
        {isFixo && (
          <Text variant="bodySm" tone="muted">
            Formas de pagamento padrão não podem ter o nome alterado.
          </Text>
        )}
      </Column>

      {!isFixo && <Button label="Salvar" onPress={handleSalvar} loading={salvando} />}
      <Button label={isFixo ? 'Voltar' : 'Cancelar'} variant="ghost" onPress={() => router.back()} />

    </Screen>
  );
}
