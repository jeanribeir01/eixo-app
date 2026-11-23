import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, type ListRenderItemInfo } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  Icon,
  Input,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Switch,
  Tabs,
  Text,
  colors,
  spacing,
  touchTarget,
  useScreenColumn,
} from '@/ui';

import { definirAtivaCategoria, listarCategorias } from './categoriasRepository';
import type { Categoria, TipoCategoria } from './types';

type Feedback = {
  mensagem: string;
  tone: 'success' | 'error';
  // Depois de desativar: "Desfazer" reativa a mesma categoria (auditoria de UI, item 6).
  desfazer?: Categoria;
};

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
      subtitle={categoria.ativa ? undefined : 'Desativada · some dos novos lançamentos'}
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

const ABAS: { tipo: TipoCategoria; rotulo: string }[] = [
  { tipo: 'Saida', rotulo: 'Saídas' },
  { tipo: 'Entrada', rotulo: 'Entradas' },
];

export function CategoriasListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarCategorias);
  const { atualizarDados } = tela;
  // Saídas primeiro: é onde fica a maioria das categorias e dos lançamentos.
  const [aba, setAba] = useState<TipoCategoria>('Saida');
  const [busca, setBusca] = useState('');
  const [verDesativadas, setVerDesativadas] = useState(false);
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
      setFeedback(
        resultado.data.ativa
          ? { mensagem: `"${categoria.titulo}" reativada.`, tone: 'success' }
          : { mensagem: `"${categoria.titulo}" desativada.`, tone: 'success', desfazer: resultado.data },
      );
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
  // O useMemo mantém os mesmos arrays enquanto dados, aba e busca não mudam.
  const { ativas, desativadas, contagem } = useMemo(() => {
    const todas = tela.dados ?? [];
    const daAba = todas.filter(
      (categoria) => categoria.tipo === aba && (!termo || categoria.titulo.toLowerCase().includes(termo)),
    );
    return {
      ativas: daAba.filter((categoria) => categoria.ativa),
      desativadas: daAba.filter((categoria) => !categoria.ativa),
      // Contagem das abas: categorias ativas de cada tipo, sem a busca (o número não pula ao digitar).
      contagem: {
        Saida: todas.filter((categoria) => categoria.tipo === 'Saida' && categoria.ativa).length,
        Entrada: todas.filter((categoria) => categoria.tipo === 'Entrada' && categoria.ativa).length,
      },
    };
  }, [tela.dados, aba, termo]);

  // Um Snackbar só: o retorno da ação vem antes do aviso de recarga que falhou.
  const snackbar = feedback ?? (tela.feedbackErro ? { mensagem: tela.feedbackErro, tone: 'error' as const } : null);
  const desfazer = feedback?.desfazer;

  return (
    <Screen
      underHeader
      list
      overlay={
        snackbar && (
          <Snackbar
            message={snackbar.mensagem}
            tone={snackbar.tone}
            action={desfazer ? { label: 'Desfazer', onPress: () => handleAlternarAtiva(desfazer) } : undefined}
            onDismiss={() => (feedback ? setFeedback(null) : tela.limparFeedbackErro())}
          />
        )
      }
      // O FAB é a ação de criar e o único azul preenchido da tela. A categoria nasce do tipo da aba.
      fab={<FAB label="Nova categoria" onPress={() => router.push(`/categorias/nova?tipo=${aba}`)} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <Tabs
          options={ABAS.map(({ tipo, rotulo }) => ({ value: tipo, label: `${rotulo} · ${contagem[tipo]}` }))}
          value={aba}
          onChange={(valor) => setAba(valor as TipoCategoria)}
          accessibilityLabel="Tipo das categorias"
        />

        <Input label="Buscar" placeholder="Buscar por nome" value={busca} onChangeText={setBusca} />

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
          data={ativas}
          keyExtractor={chaveDaCategoria}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.espacoDoFab]}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accentStrong]}
              tintColor={colors.accentStrong}
            />
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até sem categoria. Sem ação aqui,
          // porque o FAB "Nova categoria" já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="categorias"
              title={termo ? 'Nenhuma categoria encontrada' : `Nenhuma categoria de ${aba === 'Saida' ? 'saída' : 'entrada'}`}
              description={termo ? 'Tente buscar por outro nome.' : 'Crie a primeira no botão Nova categoria.'}
            />
          }
          renderItem={renderLinha}
          // Desativadas no fim, recolhidas: continuam nos lançamentos antigos, mas não atrapalham a lista.
          ListFooterComponent={
            desativadas.length > 0 ? (
              <Column gap="xs">
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: verDesativadas }}
                  accessibilityLabel={`Desativadas, ${desativadas.length}`}
                  onPress={() => setVerDesativadas((atual) => !atual)}
                  style={styles.cabecalhoDesativadas}
                >
                  <Icon name={verDesativadas ? 'recolher' : 'avancar'} size="sm" tone="body" />
                  <Text variant="bodySm" weight="medium" tone="body">
                    {`Desativadas · ${desativadas.length}`}
                  </Text>
                  {!verDesativadas && (
                    <Text variant="bodySm" tone="body" numberOfLines={1} style={styles.resumoDesativadas}>
                      {desativadas.map((categoria) => categoria.titulo).join(', ')}
                    </Text>
                  )}
                </Pressable>
                {verDesativadas &&
                  desativadas.map((categoria) => (
                    <CategoriaLinha
                      key={categoria.id}
                      categoria={categoria}
                      processando={processandoId === categoria.id}
                      onAbrir={abrir}
                      onAlternarAtiva={handleAlternarAtiva}
                    />
                  ))}
              </Column>
            ) : undefined
          }
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
  cabecalhoDesativadas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    marginTop: spacing.base,
  },
  resumoDesativadas: {
    flex: 1,
  },
});
