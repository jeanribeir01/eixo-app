import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList } from 'react-native';

import { Badge, Button, Column, EmptyState, Input, ListItem, Screen, Snackbar, Switch, Text, colors } from '@/ui';

import { definirAtivaCategoria, listarCategorias } from './categoriasRepository';
import type { Categoria } from './types';

type Status = 'carregando' | 'pronto' | 'erro';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

export function CategoriasListView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const carregar = useCallback(async () => {
    setStatus('carregando');
    const resultado = await listarCategorias();
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setCategorias(resultado.data);
    setStatus('pronto');
  }, []);

  // Recarrega ao voltar da criação/edição: a tela não desmonta na navegação em pilha,
  // então sem isso a lista ficaria com o snapshot de antes da mudança.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function handleAlternarAtiva(categoria: Categoria) {
    setProcessandoId(categoria.id);
    const resultado = await definirAtivaCategoria(categoria.id, !categoria.ativa);
    setProcessandoId(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    setCategorias((atual) => atual.map((item) => (item.id === categoria.id ? resultado.data : item)));
    setFeedback({
      mensagem: resultado.data.ativa ? 'Categoria reativada.' : 'Categoria desativada.',
      tone: 'success',
    });
  }

  const termo = busca.trim().toLowerCase();
  const categoriasFiltradas = categorias.filter((categoria) => {
    if (!mostrarDesativadas && !categoria.ativa) return false;
    if (!termo) return true;
    return categoria.titulo.toLowerCase().includes(termo);
  });

  return (
    <Screen>
      <Column gap="xs">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">Categorias</Text>
      </Column>

      <Input label="Buscar" placeholder="Buscar por título" value={busca} onChangeText={setBusca} />

      <Switch label="Mostrar desativadas" value={mostrarDesativadas} onValueChange={setMostrarDesativadas} />

      {/* Único elemento cyan preenchido da tela: a ação primária (DESIGN_CYAN §1). */}
      <Button label="Nova categoria" onPress={() => router.push('/categorias/nova')} />

      {status === 'carregando' && (
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando categorias" />
        </Column>
      )}

      {status === 'erro' && (
        <EmptyState title="Não foi possível carregar" description={erro ?? undefined} actionLabel="Tentar novamente" onAction={carregar} />
      )}

      {status === 'pronto' && categoriasFiltradas.length === 0 && (
        <EmptyState
          title={termo ? 'Nenhuma categoria encontrada' : 'Nenhuma categoria cadastrada'}
          description={termo ? 'Tente buscar por outro título.' : 'Crie a primeira categoria para começar.'}
          actionLabel={termo ? undefined : 'Nova categoria'}
          onAction={termo ? undefined : () => router.push('/categorias/nova')}
        />
      )}

      {status === 'pronto' && categoriasFiltradas.length > 0 && (
        <FlatList
          data={categoriasFiltradas}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            // Sem onPress no ListItem: dois botões-irmãos em vez de aninhar Pressable dentro de
            // Pressable, que é ambíguo tanto para o usuário (alvo de toque incerto) quanto para teste.
            <ListItem>
              <Column gap="sm">
                <Column gap="xs" align="start">
                  <Text weight="medium" tone={item.ativa ? 'primary' : 'muted'}>
                    {item.titulo}
                  </Text>
                  <Badge label={item.tipo === 'Entrada' ? 'Entrada' : 'Saída'} tone={item.tipo === 'Entrada' ? 'success' : 'danger'} />
                </Column>
                <Column direction="row" gap="sm" wrap>
                  <Button label="Editar" variant="ghost" onPress={() => router.push(`/categorias/${item.id}/editar`)} />
                  <Button
                    label={item.ativa ? 'Desativar' : 'Reativar'}
                    variant="ghost"
                    loading={processandoId === item.id}
                    onPress={() => handleAlternarAtiva(item)}
                  />
                </Column>
              </Column>
            </ListItem>
          )}
        />
      )}

      {feedback && (
        <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />
      )}
    </Screen>
  );
}
