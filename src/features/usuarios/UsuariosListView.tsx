import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { rotuloPerfil, rotuloStatus } from '@/features/auth/permissions';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { Badge, Column, EmptyState, ListItem, Screen, Skeleton, Snackbar, Text, colors } from '@/ui';

import type { Usuario } from './types';
import { listarUsuarios } from './usuariosRepository';

// Um Badge só por linha, para caber no celular pequeno. Status fora do normal tem prioridade: é o que
// o Admin precisa resolver (aprovar ou desbloquear). O perfil completo continua no detalhe.
function rotuloDoBadge(usuario: Usuario): string {
  if (usuario.status !== 'Ativo') return rotuloStatus[usuario.status];
  return rotuloPerfil[usuario.perfil.nome];
}

// Tela só do Admin (US16): a rota nem é registrada para outros perfis — ver app/(app)/_layout.tsx.
export function UsuariosListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar do detalhe (o perfil/status pode ter mudado), sem a lista piscar.
  const tela = useDadosDaTela(listarUsuarios);

  return (
    <Screen
      underHeader
      // Recarga que falhou com a lista já na tela: aviso no Snackbar, sem apagar a lista.
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : null
      }
    >
      <Text tone="body">Toque em um usuário para alterar o perfil, aprovar ou bloquear.</Text>

      {tela.status === 'carregando' && (
        <Column gap="sm">
          <Skeleton height="xxl" accessibilityLabel="Carregando usuários" />
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
          data={tela.dados ?? []}
          keyExtractor={(item) => item.id}
          style={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até sem usuário nenhum. Sem ação, porque
          // conta nova nasce do primeiro login com Google, não de um cadastro aqui.
          ListEmptyComponent={
            <EmptyState
              icon="usuarios"
              title="Nenhum usuário encontrado"
              description="Contas aparecem aqui depois do primeiro login."
            />
          }
          renderItem={({ item }) => (
            <ListItem
              title={item.nome}
              subtitle={item.email}
              trailing={<Badge label={rotuloDoBadge(item)} />}
              accessibilityLabel={`Gerenciar ${item.nome}`}
              onPress={() => router.push(`/usuarios/${item.id}`)}
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
});
