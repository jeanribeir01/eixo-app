import { useCallback } from 'react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Usuario } from '@/features/usuarios/types';
import { listarUsuarios } from '@/features/usuarios/usuariosRepository';
import { useDadosDaTela, type Resultado } from '@/lib/useDadosDaTela';
import { Avatar, Badge, Button, Card, Column, ListItem, ListSection, Screen, Text, spacing } from '@/ui';

import { signOut } from './googleAuth';
import { profileFromSession } from './perfilGoogle';
import { rotuloPerfil } from './permissions';
import { useProfile } from './profileStore';
import { useSessionStore } from './sessionStore';

// "12 pessoas · 1 aguardando aprovação": quem abre a Conta já vê se tem alguém esperando. Enquanto
// carrega (ou se falhar), a linha diz o que a tela faz, em vez de um número errado.
function resumoDaEquipe(usuarios: Usuario[] | null): string {
  if (!usuarios) return 'Aprovar, mudar perfil e bloquear';
  const aguardando = usuarios.filter((usuario) => usuario.status === 'AguardandoAprovacao').length;
  const pessoas = `${usuarios.length} ${usuarios.length === 1 ? 'pessoa' : 'pessoas'}`;
  return aguardando > 0 ? `${pessoas} · ${aguardando} aguardando aprovação` : pessoas;
}

const SEM_BUSCA = (): Promise<Resultado<Usuario[]>> => Promise.resolve({ ok: true, data: [] });

// Aba Conta (EIX-64; antes "Configurações"): quem está logado, os atalhos de administração e o Sair.
// Substitui a Home de teste da US15.
export function ContaView() {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const { usuario, isAdmin, canSeeFinanceiro } = useProfile();
  // Só o Admin lê a tabela de usuários (RLS); para os outros, nenhuma consulta.
  const buscarEquipe = useCallback(() => (isAdmin ? listarUsuarios() : SEM_BUSCA()), [isAdmin]);
  const equipe = useDadosDaTela(buscarEquipe);

  // O layout só renderiza esta tela com sessão; o retorno nulo é apenas proteção de tipo.
  if (!session) return null;

  const profile = profileFromSession(session);
  const versao = Constants.expoConfig?.version ?? '—';

  return (
    <Screen scroll>
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Conta</Text>

      <Card>
        <View style={styles.pessoa}>
          <Avatar name={profile.displayName} photoUrl={profile.photoUrl} />
          <View style={styles.textos}>
            <Text variant="title" weight="semibold">
              {profile.displayName}
            </Text>
            <Text variant="bodySm" tone="body" numberOfLines={1}>
              {profile.email}
            </Text>
            {/* Enquanto o perfil carrega, sem Badge: melhor nada do que um perfil errado. */}
            {usuario && <Badge label={rotuloPerfil[usuario.perfil]} />}
          </View>
        </View>
      </Card>

      {/* Usuários só existe para o Admin (US16); Categorias e Formas de pagamento, para quem vê o
          Caixa. A mesma entrada continua na aba Caixa: aqui é o atalho de quem administra. */}
      {(isAdmin || canSeeFinanceiro) && (
        <ListSection label={isAdmin ? 'Administração' : 'Cadastros'}>
          {isAdmin && (
            <ListItem
              title="Usuários"
              subtitle={resumoDaEquipe(equipe.status === 'pronto' ? equipe.dados : null)}
              icon="usuarios"
              onPress={() => router.push('/usuarios')}
            />
          )}
          {canSeeFinanceiro && (
            <ListItem
              title="Categorias"
              subtitle="Entradas e saídas do caixa"
              icon="categorias"
              onPress={() => router.push('/categorias')}
            />
          )}
          {canSeeFinanceiro && (
            <ListItem
              title="Formas de pagamento"
              subtitle="Pix, boleto, cartão e TED"
              icon="formasPagamento"
              onPress={() => router.push('/formas-pagamento')}
            />
          )}
        </ListSection>
      )}

      <ListSection label="Aplicativo">
        <ListItem title="Versão" icon="versao" trailing={<Text tone="body">{versao}</Text>} />
      </ListSection>

      {/* Sem confirmação: sair é reversível (é só entrar de novo), e o roteiro do vídeo sai duas vezes. */}
      <Column>
        <Button label="Sair da conta" variant="ghost" onPress={signOut} />
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pessoa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  textos: {
    flex: 1,
    gap: spacing.xs,
  },
});
