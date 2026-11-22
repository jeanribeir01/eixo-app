import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, type ListRenderItemInfo } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  List,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  Input,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Switch,
  colors,
  useScreenColumn,
} from '@/ui';

import { definirAtivaCategoria, listarCategorias } from './categoriasRepository';
import { rotuloTipoCategoria, type Categoria } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function subtitulo(categoria: Categoria): string {
  const tipo = rotuloTipoCategoria[categoria.tipo];
  return categoria.ativa ? tipo : `${tipo} · Desativada`;
}

type LinhaProps = {
  categoria: Categoria;
  // Booleano, não o id em processamento: só a linha cujo switch mudou re-renderiza.
  processando: boolean;
  onAbrir: (id: string) => void;
  onAlternarAtiva: (categoria: Categoria) => void;
};

// Linha memoizada (EIX-71): digitar na busca re-renderiza a tela a cada letra; com memo, só as linhas
// que entram ou saem do filtro renderizam. Por isso os callbacks do pai são estáveis (useCallback).
const CategoriaLinha = memo(function CategoriaLinha({ categoria, processando, onAbrir, onAlternarAtiva }: LinhaProps) {
  return (
    <ListItem
      title={categoria.titulo}
      subtitle={subtitulo(categoria)}
      onPress={() => onAbrir(categoria.id)}
      control={
        <Switch
          label="Ativa"
          accessibilityLabel={`Ativa: ${categoria.titulo}`}
          value={categoria.ativa}
          disabled={processando}
          onValueChange={() => onAlternarAtiva(categoria)}
        />
      }
    />
  );
});

// Fora do componente: a mesma função em todo render, sem precisar de useCallback.
function chaveDaCategoria(categoria: Categoria): string {
  return categoria.id;
}

export function CategoriasListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarCategorias);
  const { atualizarDados } = tela;
  const [busca, setBusca] = useState('');
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const coluna = useScreenColumn();

  const handleAlternarAtiva = useCallback(
    async (categoria: Categoria) => {
      setProcessandoId(categoria.id);
      const resultado = await definirAtivaCategoria(categoria.id, !categoria.ativa);
      setProcessandoId(null);

      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }

      atualizarDados((atuais) => atuais.map((item) => (item.id === categoria.id ? resultado.data : item)));
      setFeedback({
        mensagem: resultado.data.ativa ? 'Categoria reativada.' : 'Categoria desativada.',
        tone: 'success',
      });
    },
    [atualizarDados],
  );

  const abrir = useCallback((id: string) => router.push(`/categorias/${id}/editar`), [router]);

  const renderLinha = useCallback(
    ({ item }: ListRenderItemInfo<Categoria>) => (
      <CategoriaLinha
        categoria={item}
        processando={processandoId === item.id}
        onAbrir={abrir}
        onAlternarAtiva={handleAlternarAtiva}
      />
    ),
    [processandoId, abrir, handleAlternarAtiva],
  );

  const termo = busca.trim().toLowerCase();
  // O useMemo mantém o mesmo array enquanto dados, busca e switch não mudam.
  const categoriasFiltradas = useMemo(
    () =>
      (tela.dados ?? []).filter((categoria) => {
        if (!mostrarDesativadas && !categoria.ativa) return false;
        if (!termo) return true;
        return categoria.titulo.toLowerCase().includes(termo);
      }),
    [tela.dados, mostrarDesativadas, termo],
  );

  // Um Snackbar só: o retorno da ação vem antes do aviso de recarga que falhou.
  const snackbar = feedback ?? (tela.feedbackErro ? { mensagem: tela.feedbackErro, tone: 'error' as const } : null);

  return (
    <Screen
      underHeader
      list
      overlay={
        snackbar && (
          <Snackbar
            message={snackbar.mensagem}
            tone={snackbar.tone}
            onDismiss={() => (feedback ? setFeedback(null) : tela.limparFeedbackErro())}
          />
        )
      }
      // O FAB é a ação de criar e o único cyan da tela (DESIGN_CYAN §7).
      fab={<FAB label="Nova categoria" onPress={() => router.push('/categorias/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <Input label="Buscar" placeholder="Buscar por título" value={busca} onChangeText={setBusca} />

        <Switch label="Mostrar desativadas" value={mostrarDesativadas} onValueChange={setMostrarDesativadas} />

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando categorias" />
            <Skeleton height="xxl" />
            <Skeleton height="xxl" />
          </Column>
        )}

        {tela.status === 'erro' && (
          <EmptyState
            title="Não foi possível carregar"
            description={tela.erro ?? undefined}
            actionLabel="Tentar novamente"
            onAction={tela.recarregar}
          />
        )}
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <List
          data={categoriasFiltradas}
          keyExtractor={chaveDaCategoria}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.espacoDoFab]}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até sem categoria. Sem ação aqui,
          // porque o FAB "Nova categoria" já está na tela.
          ListEmptyComponent={
            <EmptyState
              title={termo ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
              description={termo ? 'Tente buscar por outro título.' : 'Crie a primeira categoria para começar.'}
            />
          }
          renderItem={renderLinha}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
