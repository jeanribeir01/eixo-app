import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList } from 'react-native';

import { rotuloPerfil, rotuloStatus } from '@/features/auth/permissions';
import { Badge, Column, EmptyState, ListItem, Screen, Text, colors } from '@/ui';

import type { Usuario } from './types';
import { listarUsuarios } from './usuariosRepository';

type Status = 'carregando' | 'pronto' | 'erro';

// Tela só do Admin (US16): a rota nem é registrada para outros perfis — ver app/(app)/_layout.tsx.
export function UsuariosListView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setStatus('carregando');
    const resultado = await listarUsuarios();
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setUsuarios(resultado.data);
    setStatus('pronto');
  }, []);

  // Recarrega ao voltar do detalhe: a lista não desmonta na navegação em pilha e ficaria com
  // o perfil/status de antes da alteração.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return (
    <Screen>
      <Column gap="xs">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">Usuários</Text>
        <Text tone="body">Toque em um usuário para alterar o perfil, aprovar ou bloquear.</Text>
      </Column>

      {status === 'carregando' && (
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando usuários" />
        </Column>
      )}

      {status === 'erro' && (
        <EmptyState
          title="Não foi possível carregar"
          description={erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      )}

      {status === 'pronto' && usuarios.length === 0 && (
        <EmptyState title="Nenhum usuário encontrado" description="Contas aparecem aqui depois do primeiro login." />
      )}

      {status === 'pronto' && usuarios.length > 0 && (
        <FlatList
          data={usuarios}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <ListItem accessibilityLabel={`Gerenciar ${item.nome}`} onPress={() => router.push(`/usuarios/${item.id}`)}>
              <Column gap="xs" align="start">
                <Text weight="medium">{item.nome}</Text>
                <Text variant="bodySm" tone="body">
                  {item.email}
                </Text>
                <Column direction="row" gap="sm" wrap>
                  <Text variant="bodySm">{rotuloPerfil[item.perfil.nome]}</Text>
                  {/* Status como rótulo neutro: verde/vermelho são reservados ao financeiro (DESIGN_CYAN §1). */}
                  <Badge label={rotuloStatus[item.status]} />
                </Column>
              </Column>
            </ListItem>
          )}
        />
      )}
    </Screen>
  );
}
