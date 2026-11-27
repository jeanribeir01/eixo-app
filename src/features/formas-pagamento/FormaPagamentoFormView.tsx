import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { z } from 'zod';

import { Aviso, Button, Column, EmptyState, Input, ListItem, ListSection, Screen, Skeleton, Snackbar, Text } from '@/ui';

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
      <Screen underHeader>
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando forma de pagamento" />
          <Skeleton height="xxl" />
        </Column>
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
      <Column gap="lg">
        {!modoEdicao && <Text tone="body">Cadastre como a empresa paga e recebe: Pix, boleto, cartão, TED.</Text>}

        <Input
          label="Nome"
          icone="formasPagamento"
          placeholder="Ex.: Dinheiro"
          value={nome}
          onChangeText={setNome}
          error={erros.nome}
          editable={!isFixo}
        />

        {isFixo ? (
          <Aviso tom="info" icone="bloqueado" titulo="Forma de pagamento padrão">
            Formas de pagamento padrão não podem ter o nome alterado.
          </Aviso>
        ) : (
          // Prévia de como a forma vai aparecer no seletor de Movimentação e de Dívida, enquanto digita.
          <Column gap="sm">
            <Text variant="bodySm" tone="body">
              Assim aparece nos seletores
            </Text>
            <ListSection>
              <ListItem
                icon="formasPagamento"
                title={nome.trim() || 'Nome da forma'}
                subtitle="Disponível para novos lançamentos"
              />
            </ListSection>
          </Column>
        )}

        {/* Um botão preenchido só por tela (DESIGN_CYAN §7). Forma padrão não tem o que salvar: só Voltar. */}
        <Column gap="sm">
          {!isFixo && (
            <Button
              label={modoEdicao ? 'Salvar alterações' : 'Criar forma de pagamento'}
              onPress={handleSalvar}
              loading={salvando}
            />
          )}
          <Button
            label={isFixo ? 'Voltar' : 'Cancelar'}
            variant="ghost"
            disabled={salvando}
            onPress={() => router.back()}
          />
        </Column>
      </Column>
    </Screen>
  );
}
