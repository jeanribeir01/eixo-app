import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { Button, Column, EmptyState, Input, Screen, Snackbar, Tabs, Text, colors } from '@/ui';

import { atualizarCategoria, buscarCategoriaPorId, criarCategoria } from './categoriasRepository';
import { categoriaSchema } from './schema';
import type { TipoCategoria } from './types';

type Erros = Partial<Record<'titulo' | 'tipo', string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

const opcoesTipo = [
  { label: 'Entrada', value: 'Entrada' },
  { label: 'Saída', value: 'Saida' },
];

export type CategoriaFormViewProps = {
  // Sem id: modo criar. Com id: modo editar, carrega a categoria antes de mostrar o formulário.
  categoriaId?: string;
};

export function CategoriaFormView({ categoriaId }: CategoriaFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!categoriaId;

  const [status, setStatus] = useState<StatusCarga>(modoEdicao ? 'carregando' : 'pronto');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria>('Entrada');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!categoriaId) return;

    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const resultado = await buscarCategoriaPorId(categoriaId!);
      if (cancelado) return;

      if (!resultado.ok) {
        setErroCarga(resultado.mensagem);
        setStatus('erro');
        return;
      }

      setTitulo(resultado.data.titulo);
      setTipo(resultado.data.tipo);
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [categoriaId]);

  async function handleSalvar() {
    const resultado = categoriaSchema.safeParse({ titulo, tipo });
    if (!resultado.success) {
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({ titulo: fieldErrors.titulo?.[0], tipo: fieldErrors.tipo?.[0] });
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = categoriaId
      ? await atualizarCategoria(categoriaId, resultado.data)
      : await criarCategoria(resultado.data);
    setSalvando(false);

    if (!resposta.ok) {
      // Duplicado é uma validação, não um erro de rede: aparece junto do campo Título também.
      setErros({ titulo: resposta.mensagem });
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setFeedback({
      mensagem: categoriaId ? 'Categoria atualizada.' : 'Categoria criada.',
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
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando categoria" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center">
        <EmptyState title="Não foi possível carregar a categoria" description={erroCarga ?? undefined} actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Column gap="xs">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">{modoEdicao ? 'Editar categoria' : 'Nova categoria'}</Text>
      </Column>

      <Column gap="md">
        <Input label="Título" placeholder="Ex.: Combustível" value={titulo} onChangeText={setTitulo} error={erros.titulo} />

        <Column gap="xs">
          <Text variant="bodySm" tone="body" weight="medium">
            Tipo
          </Text>
          <Tabs options={opcoesTipo} value={tipo} onChange={(valor) => setTipo(valor as TipoCategoria)} accessibilityLabel="Tipo da categoria" />
          {!!erros.tipo && (
            <Text accessibilityRole="alert" variant="bodySm">
              {erros.tipo}
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
