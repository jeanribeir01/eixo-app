import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  Input,
  ListItem,
  Screen,
  Skeleton,
  Snackbar,
  Switch,
  colors,
} from '@/ui';

import { definirAtivaCategoria, listarCategorias } from './categoriasRepository';
import { rotuloTipoCategoria, type Categoria } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function subtitulo(categoria: Categoria): string {
  const tipo = rotuloTipoCategoria[categoria.tipo];
  return categoria.ativa ? tipo : `${tipo} · Desativada`;
}

export function CategoriasListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarCategorias);
  const [busca, setBusca] = useState('');
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleAlternarAtiva(categoria: Categoria) {
    setProcessandoId(categoria.id);
    const resultado = await definirAtivaCategoria(categoria.id, !categoria.ativa);
    setProcessandoId(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    tela.atualizarDados((atuais) => atuais.map((item) => (item.id === categoria.id ? resultado.data : item)));
    setFeedback({
      mensagem: resultado.data.ativa ? 'Categoria reativada.' : 'Categoria desativada.',
      tone: 'success',
    });
  }

  const termo = busca.trim().toLowerCase();
  const categoriasFiltradas = (tela.dados ?? []).filter((categoria) => {
    if (!mostrarDesativadas && !categoria.ativa) return false;
    if (!termo) return true;
    return categoria.titulo.toLowerCase().includes(termo);
  });

  // Um Snackbar só: o retorno da ação vem antes do aviso de recarga que falhou.
  const snackbar = feedback ?? (tela.feedbackErro ? { mensagem: tela.feedbackErro, tone: 'error' as const } : null);

  return (
    <Screen
      underHeader
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

      {tela.status === 'pronto' && (
        <FlatList
          data={categoriasFiltradas}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          contentContainerStyle={styles.espacoDoFab}
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
          renderItem={({ item }) => (
            <ListItem
              title={item.titulo}
              subtitle={subtitulo(item)}
              onPress={() => router.push(`/categorias/${item.id}/editar`)}
              control={
                <Switch
                  label="Ativa"
                  accessibilityLabel={`Ativa: ${item.titulo}`}
                  value={item.ativa}
                  disabled={processandoId === item.id}
                  onValueChange={() => handleAlternarAtiva(item)}
                />
              }
            />
          )}
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
