import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, type ListRenderItemInfo } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  AvisoSemInternet,
  CampoBusca,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  GrupoRecolhivel,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Tabs,
  colors,
  useScreenColumn,
} from '@/ui';

import { listarCategorias } from './categoriasRepository';
import type { Categoria, TipoCategoria } from './types';

type LinhaProps = {
  categoria: Categoria;
  onAbrir: (id: string) => void;
};

// Linha memoizada (EIX-71): digitar na busca re-renderiza a tela a cada letra; com memo, só as linhas
// que entram ou saem do filtro renderizam. Por isso o callback do pai é estável (useCallback).
// Sem switch na linha: desativar e reativar ficam no Editar, como nas outras listas de cadastro
// (um toque sem querer na cabine não tira mais uma categoria dos lançamentos).
const CategoriaLinha = memo(function CategoriaLinha({ categoria, onAbrir }: LinhaProps) {
  return <ListItem title={categoria.titulo} onPress={() => onAbrir(categoria.id)} />;
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
  // Saídas primeiro: é onde fica a maioria das categorias e dos lançamentos.
  const [aba, setAba] = useState<TipoCategoria>('Saida');
  const [busca, setBusca] = useState('');
  const coluna = useScreenColumn();

  const abrir = useCallback((id: string) => router.push(`/categorias/${id}/editar`), [router]);

  const renderLinha = useCallback(
    ({ item }: ListRenderItemInfo<Categoria>) => <CategoriaLinha categoria={item} onAbrir={abrir} />,
    [abrir],
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

  return (
    <Screen
      underHeader
      list
      // Aviso de recarga que falhou (os dados antigos continuam na tela).
      overlay={tela.feedbackErro ? <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} /> : null}
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

        <CampoBusca placeholder="Buscar categoria" value={busca} onChangeText={setBusca} />

        {tela.semInternet && tela.status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

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
          // No celular a lista fica dentro do respiro lateral da tela: a barra de rolagem do Android
          // aparecia por cima das setas e dos valores das linhas.
          showsVerticalScrollIndicator={false}
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
          // Desativadas no fim, recolhidas: continuam nos lançamentos antigos e abrem para reativar.
          ListFooterComponent={
            desativadas.length > 0 ? (
              <GrupoRecolhivel
                rotulo="Desativadas"
                quantidade={desativadas.length}
                resumo={desativadas.map((categoria) => categoria.titulo).join(', ')}
              >
                {desativadas.map((categoria) => (
                  <CategoriaLinha key={categoria.id} categoria={categoria} onAbrir={abrir} />
                ))}
              </GrupoRecolhivel>
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
});
