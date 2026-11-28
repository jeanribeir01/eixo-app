import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { trecho, ufsDoTrecho } from '@/lib/trecho';
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

import { chaveCidade } from './cidade';
import { listarRotas } from './rotasRepository';
import type { RotaComViagens } from './types';

function subtitulo(rota: RotaComViagens): string {
  // Mesmo formato da capacidade em Veículos: vírgula decimal e até 2 casas ("408,5 km").
  const distancia = `${rota.distancia_estimada_km.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
  const viagens =
    rota.viagens_finalizadas === 1 ? '1 viagem finalizada' : `${rota.viagens_finalizadas} viagens finalizadas`;
  // A UF fica aqui, e não no título: separa duas rotas de mesmo nome sem quebrar a linha do trecho.
  return `${ufsDoTrecho(rota)} · ${distancia} · ${viagens}`;
}

// Cabeçalho e rotas numa FlatList só, como nas outras listas do redesign.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'rota'; id: string; rota: RotaComViagens };

function comCabecalho(rotas: RotaComViagens[]): Linha[] {
  if (rotas.length === 0) return [];
  return [
    { tipo: 'grupo', id: 'grupo-ativas', rotulo: `Ativas · ${rotas.length}` },
    ...rotas.map((rota): Linha => ({ tipo: 'rota', id: rota.id, rota })),
  ];
}

type LinhaDaRotaProps = { rota: RotaComViagens; onAbrir: (id: string) => void };

// Sem switch na linha: desativar e reativar ficam no Editar, como nas outras listas de cadastro.
function LinhaDaRota({ rota, onAbrir }: LinhaDaRotaProps) {
  return <ListItem icon="rotas" title={trecho(rota)} subtitle={subtitulo(rota)} onPress={() => onAbrir(rota.id)} />;
}

export function RotasListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarRotas);
  const [busca, setBusca] = useState('');
  const coluna = useScreenColumn();

  function abrir(id: string) {
    router.push(`/rotas/${id}/editar`);
  }

  // Busca local (catálogo pequeno): `chaveCidade` ignora maiúscula, espaço e acento, então
  // "sao" encontra "São Paulo" — a mesma regra que o banco usa para rota duplicada.
  const termo = chaveCidade(busca);
  const { linhas, desativadas } = useMemo(() => {
    const encontradas = (tela.dados ?? []).filter(
      (rota) => !termo || chaveCidade(rota.cidade_origem).includes(termo) || chaveCidade(rota.cidade_destino).includes(termo),
    );
    return {
      linhas: comCabecalho(encontradas.filter((rota) => rota.ativa)),
      desativadas: encontradas.filter((rota) => !rota.ativa),
    };
  }, [tela.dados, termo]);

  return (
    <Screen
      underHeader
      list
      // Aviso de recarga que falhou (os dados antigos continuam na tela).
      overlay={tela.feedbackErro ? <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} /> : null}
      // O FAB é a ação de criar e o único azul preenchido da tela (DESIGN_CYAN §7).
      fab={<FAB label="Nova rota" onPress={() => router.push('/rotas/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <CampoBusca placeholder="Buscar por cidade" value={busca} onChangeText={setBusca} />

        {tela.semInternet && tela.status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando rotas" />
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
          keyExtractor={(linha) => linha.id}
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
          // Vazio dentro da lista: o pull-to-refresh funciona até sem rota. Sem ação aqui,
          // porque o FAB "Nova rota" já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="rotas"
              title={termo ? 'Nenhuma rota encontrada' : 'Nenhuma rota cadastrada'}
              description={termo ? 'Tente buscar por outra cidade.' : 'Cadastre o primeiro trecho para começar.'}
            />
          }
          renderItem={({ item }) =>
            item.tipo === 'grupo' ? (
              <View style={styles.grupo}>
                <TituloSecao titulo={item.rotulo} />
              </View>
            ) : (
              <LinhaDaRota rota={item.rota} onAbrir={abrir} />
            )
          }
          // Desativadas no fim, recolhidas: continuam no histórico das viagens e abrem para reativar.
          ListFooterComponent={
            desativadas.length > 0 ? (
              <GrupoRecolhivel rotulo="Desativadas" quantidade={desativadas.length} resumo={desativadas.map(trecho).join(', ')}>
                {desativadas.map((rota) => (
                  <LinhaDaRota key={rota.id} rota={rota} onAbrir={abrir} />
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
