import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import {
  Aviso,
  Button,
  Column,
  EmptyState,
  Input,
  MensagemErro,
  OpcaoSelecionavel,
  Screen,
  Snackbar,
  Text,
  colors,
  spacing,
} from '@/ui';

import { atualizarCategoria, buscarCategoriaPorId, criarCategoria, definirAtivaCategoria } from './categoriasRepository';
import { categoriaSchema } from './schema';
import { rotuloTipoCategoria, type TipoCategoria } from './types';

type Erros = Partial<Record<'titulo' | 'tipo', string>>;
// `desfazer`: depois de desativar, o Snackbar oferece "Desfazer" (reativa na hora).
type Feedback = { mensagem: string; tone: 'success' | 'error'; desfazer?: boolean };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

// Cada tipo diz o que significa: "Entrada" sozinho não diz para que lado vai o dinheiro.
const OPCOES_TIPO: { tipo: TipoCategoria; descricao: string }[] = [
  { tipo: 'Saida', descricao: 'Dinheiro que sai do caixa' },
  { tipo: 'Entrada', descricao: 'Dinheiro que entra no caixa' },
];

export type CategoriaFormViewProps = {
  // Sem id: modo criar. Com id: modo editar, carrega a categoria antes de mostrar o formulário.
  categoriaId?: string;
  // Modo criar: o tipo já vem escolhido pela aba de onde a pessoa veio (Saídas ou Entradas). Sem ele,
  // nada vem marcado e o formulário pede a escolha.
  tipoInicial?: TipoCategoria;
};

export function CategoriaFormView({ categoriaId, tipoInicial }: CategoriaFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!categoriaId;

  const [status, setStatus] = useState<StatusCarga>(modoEdicao ? 'carregando' : 'pronto');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoCategoria | null>(tipoInicial ?? null);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [ativa, setAtiva] = useState(true);
  const [alterandoAtiva, setAlterandoAtiva] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // O "Desfazer" do Snackbar também fecha o Snackbar: sem esta marca, o fechamento voltaria para a lista
  // antes de a reativação terminar.
  const desfazendo = useRef(false);

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
      setAtiva(resultado.data.ativa);
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [categoriaId]);

  async function handleSalvar() {
    const resultado = categoriaSchema.safeParse({ titulo, tipo: tipo ?? undefined });
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

  // Desativar e reativar moram aqui, no fim do Editar, e não mais num switch na lista: é o mesmo lugar
  // em Categorias, Formas de pagamento, Rotas e Veículos, e um toque sem querer não tira a categoria do uso.
  async function handleAlterarAtiva(novoValor: boolean) {
    if (!categoriaId) return;
    setAlterandoAtiva(true);
    const resposta = await definirAtivaCategoria(categoriaId, novoValor);
    setAlterandoAtiva(false);

    if (!resposta.ok) {
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setAtiva(resposta.data.ativa);
    setFeedback(
      resposta.data.ativa
        ? { mensagem: 'Categoria reativada.', tone: 'success' }
        : { mensagem: 'Categoria desativada.', tone: 'success', desfazer: true },
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
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accentStrong} accessibilityLabel="Carregando categoria" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar a categoria"
          description={erroCarga ?? undefined}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

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
      {modoEdicao && !ativa && (
        <Aviso tom="info" icone="bloqueado" titulo="Categoria desativada">
          Não aparece nos novos lançamentos. Para usar de novo, reative no fim da tela.
        </Aviso>
      )}

      <Column gap="sm">
        <Text variant="bodySm" weight="medium">
          Tipo
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Tipo da categoria" style={styles.opcoes}>
          {OPCOES_TIPO.map((opcao) => (
            <OpcaoSelecionavel
              key={opcao.tipo}
              titulo={rotuloTipoCategoria[opcao.tipo]}
              descricao={opcao.descricao}
              icon={opcao.tipo === 'Entrada' ? 'entrada' : 'saida'}
              selecionada={tipo === opcao.tipo}
              onPress={() => setTipo(opcao.tipo)}
            />
          ))}
        </View>
        {!!erros.tipo && <MensagemErro>{erros.tipo}</MensagemErro>}
      </Column>

      <Input label="Título" placeholder="Ex.: Combustível" value={titulo} onChangeText={setTitulo} error={erros.titulo} />

      {/* Sem "Cancelar": o voltar do header já desiste sem salvar. */}
      <Button
        label={modoEdicao ? 'Salvar alterações' : 'Criar categoria'}
        onPress={handleSalvar}
        loading={salvando}
        disabled={alterandoAtiva}
      />

      {/* Ação de status no fim, longe da ação primária, com a consequência dita embaixo (DESIGN_CYAN §7,
          botão de perigo). Reativar não é grave: botão secundário. */}
      {modoEdicao && (
        <View style={styles.status}>
          <Column gap="sm">
            <Button
              label={ativa ? 'Desativar categoria' : 'Reativar categoria'}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  opcoes: {
    gap: spacing.sm,
  },
  // Afasta a ação de status do "Salvar": as duas não podem parecer a mesma decisão.
  status: {
    marginTop: spacing.lg,
  },
});
