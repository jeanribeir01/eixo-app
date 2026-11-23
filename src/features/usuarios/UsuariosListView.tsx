import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { rotuloCurtoPerfil, rotuloPerfil, rotuloStatus, type StatusUsuario } from '@/features/auth/permissions';
import { useProfile } from '@/features/auth/profileStore';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Column,
  EmptyState,
  Input,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  colors,
  spacing,
  useScreenColumn,
  type BadgeTone,
} from '@/ui';

import type { Usuario } from './types';
import { alterarStatusUsuario, listarUsuarios } from './usuariosRepository';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

// Um Badge só por linha, com o nome curto do perfil, para caber no celular pequeno. Bloqueado tem prioridade: é o que o Admin
// precisa ver. Admin em destaque (neutral); os outros perfis, sem ênfase.
function badgeDaEquipe(usuario: Usuario): { label: string; tone: BadgeTone } {
  if (usuario.status === 'Bloqueado') return { label: rotuloStatus.Bloqueado, tone: 'danger' };
  return { label: rotuloCurtoPerfil[usuario.perfil.nome], tone: usuario.perfil.nome === 'Admin' ? 'neutral' : 'muted' };
}

type LinhaProps = {
  usuario: Usuario;
  ehVoce: boolean;
  onAbrir: (id: string) => void;
};

// Linha memoizada (EIX-71): um Snackbar ou o pull-to-refresh re-renderizam a tela, mas a linha só
// renderiza de novo quando o próprio usuário muda. Por isso o callback do pai é estável (useCallback).
const UsuarioLinha = memo(function UsuarioLinha({ usuario, ehVoce, onAbrir }: LinhaProps) {
  const badge = badgeDaEquipe(usuario);
  return (
    <ListItem
      leading={<Avatar name={usuario.nome} photoUrl={null} size="sm" />}
      title={ehVoce ? `${usuario.nome} (você)` : usuario.nome}
      subtitle={usuario.email}
      trailing={<Badge label={badge.label} tone={badge.tone} />}
      accessibilityLabel={`Gerenciar ${usuario.nome}`}
      onPress={() => onAbrir(usuario.id)}
    />
  );
});

type PedidoProps = {
  usuario: Usuario;
  // Qual botão deste cartão está salvando; null = nenhum.
  salvando: StatusUsuario | null;
  bloqueado: boolean;
  onDecidir: (usuario: Usuario, status: StatusUsuario) => void;
};

// Pedido de acesso: quem entrou com Google e espera o Admin. Fica no topo porque é a única coisa da
// tela que tem alguém esperando (auditoria de UI, item 6).
function PedidoDeAcesso({ usuario, salvando, bloqueado, onDecidir }: PedidoProps) {
  return (
    <Card>
      <View style={styles.pessoa}>
        <Avatar name={usuario.nome} photoUrl={null} size="sm" />
        <Column gap="xs">
          <Text weight="medium">{usuario.nome}</Text>
          <Text variant="bodySm" tone="body">
            {usuario.email}
          </Text>
        </Column>
      </View>
      <Text variant="bodySm" tone="body">
        {`Entrou com Google e espera liberação. Ao aprovar, começa como ${rotuloPerfil[usuario.perfil.nome]}; dá para mudar o perfil depois.`}
      </Text>
      <View style={styles.botoes}>
        <View style={styles.botao}>
          <Button
            label="Recusar"
            variant="ghost"
            accessibilityLabel={`Recusar ${usuario.nome}`}
            onPress={() => onDecidir(usuario, 'Bloqueado')}
            loading={salvando === 'Bloqueado'}
            disabled={bloqueado}
          />
        </View>
        <View style={styles.botao}>
          <Button
            label="Aprovar"
            accessibilityLabel={`Aprovar ${usuario.nome}`}
            onPress={() => onDecidir(usuario, 'Ativo')}
            loading={salvando === 'Ativo'}
            disabled={bloqueado}
          />
        </View>
      </View>
    </Card>
  );
}

// Fora do componente: a mesma função em todo render, sem precisar de useCallback.
function chaveDoUsuario(usuario: Usuario): string {
  return usuario.id;
}

// Tela só do Admin (US16): a rota nem é registrada para outros perfis — ver app/(app)/_layout.tsx.
export function UsuariosListView() {
  const router = useRouter();
  const { usuario: logado } = useProfile();
  // Carrega ao abrir e ao voltar do detalhe (o perfil/status pode ter mudado), sem a lista piscar.
  const tela = useDadosDaTela(listarUsuarios);
  const { atualizarDados } = tela;
  const coluna = useScreenColumn();
  const [busca, setBusca] = useState('');
  const [decidindo, setDecidindo] = useState<{ id: string; status: StatusUsuario } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const abrir = useCallback((id: string) => router.push(`/usuarios/${id}`), [router]);

  const decidir = useCallback(
    async (usuario: Usuario, status: StatusUsuario) => {
      setDecidindo({ id: usuario.id, status });
      const resultado = await alterarStatusUsuario(usuario.id, status);
      setDecidindo(null);

      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }
      // Só o retorno do banco muda a lista: o pedido sai do topo e entra na equipe.
      atualizarDados((atuais) => atuais.map((item) => (item.id === usuario.id ? resultado.data : item)));
      setFeedback({
        mensagem: status === 'Ativo' ? `${usuario.nome} aprovado.` : `${usuario.nome} recusado.`,
        tone: 'success',
      });
    },
    [atualizarDados],
  );

  const termo = busca.trim().toLowerCase();
  const { pedidos, equipe } = useMemo(() => {
    const filtrados = (tela.dados ?? []).filter(
      (usuario) => !termo || usuario.nome.toLowerCase().includes(termo) || usuario.email.toLowerCase().includes(termo),
    );
    return {
      pedidos: filtrados.filter((usuario) => usuario.status === 'AguardandoAprovacao'),
      equipe: filtrados.filter((usuario) => usuario.status !== 'AguardandoAprovacao'),
    };
  }, [tela.dados, termo]);

  const renderLinha = useCallback(
    ({ item }: ListRenderItemInfo<Usuario>) => <UsuarioLinha usuario={item} ehVoce={item.id === logado?.id} onAbrir={abrir} />,
    [abrir, logado?.id],
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
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <Input
          label="Buscar"
          placeholder="Nome ou e-mail"
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
        />

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
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <List
          data={equipe}
          keyExtractor={chaveDoUsuario}
          style={styles.lista}
          contentContainerStyle={coluna}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accentStrong]}
              tintColor={colors.accentStrong}
            />
          }
          ListHeaderComponent={
            <Column gap="md">
              {pedidos.length > 0 && (
                <Column gap="sm">
                  <Text variant="title" weight="semibold" accessibilityRole="header">
                    {`Aguardando aprovação · ${pedidos.length}`}
                  </Text>
                  {pedidos.map((usuario) => (
                    <PedidoDeAcesso
                      key={usuario.id}
                      usuario={usuario}
                      salvando={decidindo?.id === usuario.id ? decidindo.status : null}
                      bloqueado={decidindo !== null}
                      onDecidir={decidir}
                    />
                  ))}
                </Column>
              )}
              {equipe.length > 0 && (
                <Text variant="title" weight="semibold" accessibilityRole="header">
                  {`Equipe · ${equipe.length}`}
                </Text>
              )}
            </Column>
          }
          // Vazio dentro da lista: o pull-to-refresh funciona até sem usuário nenhum. Sem ação, porque
          // conta nova nasce do primeiro login com Google, não de um cadastro aqui.
          ListEmptyComponent={
            pedidos.length > 0 ? null : (
              <EmptyState
                icon="usuarios"
                title={termo ? 'Ninguém com esse nome ou e-mail' : 'Nenhum usuário encontrado'}
                description={termo ? 'Confira a grafia ou busque por outro termo.' : 'Contas aparecem aqui depois do primeiro login.'}
              />
            )
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
  pessoa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  botoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  botao: {
    flex: 1,
  },
});
