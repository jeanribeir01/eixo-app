import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useCargaUnica } from '@/lib/useCargaUnica';
import { Aviso, Button, Column, EmptyState, Input, Screen, Skeleton, Snackbar, Text, spacing } from '@/ui';

import {
  atualizarFormaPagamento,
  buscarFormaPagamentoPorId,
  criarFormaPagamento,
  definirAtivaFormaPagamento,
} from './formasPagamentoRepository';
import { formaPagamentoSchema } from './schema';
import { isFormaFixa } from './types';

type Erros = Partial<Record<'nome', string>>;
// `desfazer`: depois de desativar, o Snackbar oferece "Desfazer" (reativa na hora).
type Feedback = { mensagem: string; tone: 'success' | 'error'; desfazer?: boolean };
export type FormaPagamentoFormViewProps = {
  formaPagamentoId?: string;
};

export function FormaPagamentoFormView({ formaPagamentoId }: FormaPagamentoFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!formaPagamentoId;

  const [nome, setNome] = useState('');
  const [nomeOriginal, setNomeOriginal] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [ativa, setAtiva] = useState(true);
  const [alterandoAtiva, setAlterandoAtiva] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // O "Desfazer" do Snackbar também fecha o Snackbar: sem esta marca, o fechamento voltaria para a lista
  // antes de a reativação terminar.
  const desfazendo = useRef(false);

  // Carga única no Editar (useCargaUnica): sem internet a tela diz isso na hora e tenta de novo sozinha
  // quando a conexão volta.
  const buscarForma = useCallback(() => buscarFormaPagamentoPorId(formaPagamentoId!), [formaPagamentoId]);
  const { status, erro: erroCarga } = useCargaUnica(formaPagamentoId ? buscarForma : null, (forma) => {
    setNome(forma.nome);
    setNomeOriginal(forma.nome);
    setAtiva(forma.ativa);
  });

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

  // Desativar e reativar moram aqui, no fim do Editar, e não mais num switch na lista: é o mesmo lugar
  // em Categorias, Formas de pagamento, Rotas e Veículos, e um toque sem querer não tira a forma do uso.
  async function handleAlterarAtiva(novoValor: boolean) {
    if (!formaPagamentoId) return;
    setAlterandoAtiva(true);
    const resposta = await definirAtivaFormaPagamento(formaPagamentoId, novoValor);
    setAlterandoAtiva(false);

    if (!resposta.ok) {
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setAtiva(resposta.data.ativa);
    setFeedback(
      resposta.data.ativa
        ? { mensagem: 'Forma de pagamento reativada.', tone: 'success' }
        : { mensagem: 'Forma de pagamento desativada.', tone: 'success', desfazer: true },
    );
  }

  function handleDesfazer() {
    desfazendo.current = true;
    handleAlterarAtiva(true);
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (desfazendo.current) {
      desfazendo.current = false;
      return;
    }
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
      overlay={
        feedback && (
          <Snackbar
            message={feedback.mensagem}
            tone={feedback.tone}
            // Com "Desfazer", o Snackbar usa o tempo maior dele, para dar tempo de tocar.
            duration={feedback.desfazer ? undefined : 1200}
            action={feedback.desfazer ? { label: 'Desfazer', onPress: handleDesfazer } : undefined}
            onDismiss={handleFeedbackDismiss}
          />
        )
      }
    >
      <Column gap="lg">
        {!modoEdicao && <Text tone="body">Cadastre como a empresa paga e recebe: Pix, boleto, cartão, TED.</Text>}

        {modoEdicao && !ativa && (
          <Aviso tom="info" icone="bloqueado" titulo="Forma de pagamento desativada">
            Não aparece nos novos lançamentos. Para usar de novo, reative no fim da tela.
          </Aviso>
        )}

        <Input
          label="Nome"
          icone="formasPagamento"
          placeholder="Ex.: Dinheiro"
          value={nome}
          onChangeText={setNome}
          error={erros.nome}
          editable={!isFixo}
        />

        {isFixo && (
          <Aviso tom="info" icone="bloqueado" titulo="Forma de pagamento padrão">
            Formas de pagamento padrão não podem ter o nome alterado nem ser desativadas.
          </Aviso>
        )}

        {/* Um botão preenchido só por tela (DESIGN_CYAN §7). Forma padrão não tem o que salvar: só Voltar. */}
        <Column gap="sm">
          {!isFixo && (
            <Button
              label={modoEdicao ? 'Salvar alterações' : 'Criar forma de pagamento'}
              onPress={handleSalvar}
              loading={salvando}
              disabled={alterandoAtiva}
            />
          )}
          <Button
            label={isFixo ? 'Voltar' : 'Cancelar'}
            variant="ghost"
            disabled={salvando || alterandoAtiva}
            onPress={() => router.back()}
          />
        </Column>

        {modoEdicao && !isFixo && (
          <View style={styles.status}>
            {/* Ação de status no fim, longe da ação primária, com a consequência dita embaixo (DESIGN_CYAN §7,
                botão de perigo). Reativar não é grave: botão secundário. */}
            <Column gap="sm">
              <Button
                label={ativa ? 'Desativar forma de pagamento' : 'Reativar forma de pagamento'}
                variant={ativa ? 'danger' : 'ghost'}
                onPress={() => handleAlterarAtiva(!ativa)}
                loading={alterandoAtiva}
                disabled={salvando}
              />
              <Text variant="bodySm" tone="body">
                {ativa
                  ? 'Ela some dos novos lançamentos. Os lançamentos antigos continuam com ela.'
                  : 'Ela volta a aparecer nos novos lançamentos.'}
              </Text>
            </Column>
          </View>
        )}
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Afasta a ação de status do "Salvar": as duas não podem parecer a mesma decisão.
  status: {
    marginTop: spacing.lg,
  },
});
