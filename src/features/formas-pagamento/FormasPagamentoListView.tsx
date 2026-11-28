import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

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
  TituloSecao,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { listarFormasPagamento } from './formasPagamentoRepository';
import { isFormaFixa, type FormaPagamento } from './types';

type LinhaProps = {
  forma: FormaPagamento;
  onAbrir: (id: string) => void;
};

// Linha memoizada (EIX-71): digitar na busca re-renderiza a tela a cada letra; com memo, só as linhas
// que entram ou saem do filtro renderizam. Por isso o callback do pai é estável (useCallback).
// Sem switch na linha: desativar e reativar ficam no Editar, como nas outras listas de cadastro.
const FormaPagamentoLinha = memo(function FormaPagamentoLinha({ forma, onAbrir }: LinhaProps) {
  const fixa = isFormaFixa(forma.nome);
  return (
    <ListItem
      icon="formasPagamento"
      title={forma.nome}
      // Forma fixa (do seed) não muda e não abre: o grupo "Padrão do sistema" já diz por quê, sem
      // repetir o aviso em cada linha.
      onPress={fixa ? undefined : () => onAbrir(forma.id)}
    />
  );
});

// Cabeçalho e formas numa FlatList só, como nas outras listas do redesign.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'forma'; id: string; forma: FormaPagamento };

// Dois grupos: as que a empresa cadastrou (abrem o Editar) e as fixas do sistema (não abrem). Grupo
// vazio, por exemplo depois de uma busca, não aparece.
function comCabecalho(formas: FormaPagamento[]): Linha[] {
  const daEmpresa = formas.filter((forma) => !isFormaFixa(forma.nome));
  const fixas = formas.filter((forma) => isFormaFixa(forma.nome));
  const grupo = (id: string, rotulo: string, lista: FormaPagamento[]): Linha[] =>
    lista.length === 0
      ? []
      : [
          { tipo: 'grupo', id, rotulo: `${rotulo} · ${lista.length}` },
          ...lista.map((forma): Linha => ({ tipo: 'forma', id: forma.id, forma })),
        ];
  return [...grupo('grupo-empresa', 'Cadastradas pela empresa', daEmpresa), ...grupo('grupo-fixas', 'Padrão do sistema', fixas)];
}

// Fora do componente: a mesma função em todo render, sem precisar de useCallback.
function chaveDaLinha(linha: Linha): string {
  return linha.id;
}

export function FormasPagamentoListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarFormasPagamento);
  const [busca, setBusca] = useState('');
  const coluna = useScreenColumn();

  const abrir = useCallback((id: string) => router.push(`/formas-pagamento/${id}/editar`), [router]);

  const renderLinha = useCallback(
    ({ item }: ListRenderItemInfo<Linha>) =>
      item.tipo === 'grupo' ? (
        <View style={styles.grupo}>
          <TituloSecao titulo={item.rotulo} />
        </View>
      ) : (
        <FormaPagamentoLinha forma={item.forma} onAbrir={abrir} />
      ),
    [abrir],
  );

  const termo = busca.trim().toLowerCase();
  // O useMemo mantém os mesmos arrays enquanto dados e busca não mudam.
  const { linhas, desativadas } = useMemo(() => {
    const encontradas = (tela.dados ?? []).filter((forma) => !termo || forma.nome.toLowerCase().includes(termo));
    return {
      linhas: comCabecalho(encontradas.filter((forma) => forma.ativa)),
      desativadas: encontradas.filter((forma) => !forma.ativa),
    };
  }, [tela.dados, termo]);

  return (
    <Screen
      underHeader
      list
      // Aviso de recarga que falhou (os dados antigos continuam na tela).
      overlay={tela.feedbackErro ? <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} /> : null}
      // O FAB é a ação de criar e o único azul preenchido da tela (DESIGN_CYAN §7).
      fab={<FAB label="Nova forma de pagamento" onPress={() => router.push('/formas-pagamento/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <CampoBusca placeholder="Buscar forma de pagamento" value={busca} onChangeText={setBusca} />

        {tela.semInternet && tela.status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando formas de pagamento" />
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
          data={linhas}
          keyExtractor={chaveDaLinha}
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
          // Vazio dentro da lista: o pull-to-refresh funciona até sem forma nenhuma. Sem ação aqui,
          // porque o FAB já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="formasPagamento"
              title={termo ? 'Nenhuma forma de pagamento encontrada' : 'Nenhuma forma de pagamento cadastrada'}
              description={termo ? 'Tente buscar por outro nome.' : 'Crie a primeira forma de pagamento para começar.'}
            />
          }
          renderItem={renderLinha}
          // Desativadas no fim, recolhidas: continuam nos lançamentos antigos e abrem para reativar.
          ListFooterComponent={
            desativadas.length > 0 ? (
              <GrupoRecolhivel
                rotulo="Desativadas"
                quantidade={desativadas.length}
                resumo={desativadas.map((forma) => forma.nome).join(', ')}
              >
                {desativadas.map((forma) => (
                  <FormaPagamentoLinha key={forma.id} forma={forma} onAbrir={abrir} />
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
  grupo: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
