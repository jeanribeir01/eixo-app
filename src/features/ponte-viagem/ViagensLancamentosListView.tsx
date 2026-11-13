import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { EmptyState, ListItem, Screen, Snackbar, colors } from '@/ui';

import { descricaoViagem, listarViagensVinculaveis, rotuloViagem } from './ponteRepository';

// "Lançamentos por viagem" (US09), aberto pelo hub Financeiro: as mesmas viagens do seletor do
// formulário (em andamento e concluídas nos últimos 30 dias). Tocar numa abre o detalhe.
export function ViagensLancamentosListView() {
  const router = useRouter();
  // A função do repositório é estável (import do módulo): o hook não refaz a consulta à toa.
  const tela = useDadosDaTela(listarViagensVinculaveis);

  if (tela.status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando viagens" />
      </Screen>
    );
  }

  if (tela.status === 'erro' || !tela.dados) {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          icon="viagens"
          title="Não foi possível carregar as viagens"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
      </Screen>
    );
  }

  return (
    <Screen
      underHeader
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <FlatList
        data={tela.dados}
        keyExtractor={(viagem) => viagem.id}
        refreshControl={
          <RefreshControl
            refreshing={tela.atualizando}
            onRefresh={tela.puxarParaAtualizar}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        // As viagens nascem na aba Viagens (Gestor e Motorista), não aqui: o vazio não tem ação de criar.
        ListEmptyComponent={
          <EmptyState
            icon="viagens"
            title="Nenhuma viagem por aqui"
            description="Viagens em andamento e concluídas nos últimos 30 dias aparecem nesta lista."
          />
        }
        renderItem={({ item }) => (
          <ListItem
            icon="viagens"
            title={rotuloViagem(item)}
            subtitle={descricaoViagem(item)}
            onPress={() => router.push(`/viagens/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
