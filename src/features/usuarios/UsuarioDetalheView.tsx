import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { rotuloPerfil, rotuloStatus, type StatusUsuario } from '@/features/auth/permissions';
import { useProfile } from '@/features/auth/profileStore';
import { Badge, Button, Column, EmptyState, ListItem, Screen, Snackbar, Text, colors } from '@/ui';

import type { Perfil, Usuario } from './types';
import {
  alterarPerfilUsuario,
  alterarStatusUsuario,
  buscarUsuarioPorId,
  listarPerfis,
  type Resultado,
} from './usuariosRepository';

type Status = 'carregando' | 'pronto' | 'erro';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

type Acao = 'perfil' | 'aprovar' | 'bloquear';

// Ordem de privilégio, do maior para o menor, para a lista de escolha ler de cima para baixo.
const ORDEM_PERFIS: Perfil['nome'][] = ['Admin', 'Gestor de Frota', 'Financeiro', 'Motorista'];

export function UsuarioDetalheView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario: usuarioLogado } = useProfile();

  const [status, setStatus] = useState<Status>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState<string | null>(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<Acao | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const carregar = useCallback(async () => {
    setStatus('carregando');
    const [resultadoUsuario, resultadoPerfis] = await Promise.all([buscarUsuarioPorId(id), listarPerfis()]);

    if (!resultadoUsuario.ok) {
      setErro(resultadoUsuario.mensagem);
      setStatus('erro');
      return;
    }
    if (!resultadoPerfis.ok) {
      setErro(resultadoPerfis.mensagem);
      setStatus('erro');
      return;
    }

    setUsuario(resultadoUsuario.data);
    setPerfilSelecionadoId(resultadoUsuario.data.perfil.id);
    const ordenados = [...resultadoPerfis.data].sort(
      (a, b) => ORDEM_PERFIS.indexOf(a.nome) - ORDEM_PERFIS.indexOf(b.nome),
    );
    setPerfis(ordenados);
    setStatus('pronto');
  }, [id]);

  // Mesmo padrão das listas: carrega ao ganhar foco (e não num useEffect que chama setState).
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  // O banco já recusa (trigger da EIX-30); esconder as ações evita o erro e explica o motivo.
  const ehOProprioUsuario = usuarioLogado?.id === id;

  async function executar(acao: Acao, mensagemSucesso: string, operacao: () => Promise<Resultado<Usuario>>) {
    setAcaoEmAndamento(acao);
    const resultado = await operacao();
    setAcaoEmAndamento(null);

    // Em erro os dados da tela continuam os de antes: só o retorno do banco atualiza o usuário.
    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    setUsuario(resultado.data);
    setPerfilSelecionadoId(resultado.data.perfil.id);
    setFeedback({ mensagem: mensagemSucesso, tone: 'success' });
  }

  function handleSalvarPerfil() {
    if (!perfilSelecionadoId) return;
    executar('perfil', 'Perfil atualizado.', () => alterarPerfilUsuario(id, perfilSelecionadoId));
  }

  function handleAlterarStatus(novoStatus: StatusUsuario) {
    const aprovar = novoStatus === 'Ativo';
    executar(aprovar ? 'aprovar' : 'bloquear', aprovar ? 'Usuário aprovado.' : 'Usuário bloqueado.', () =>
      alterarStatusUsuario(id, novoStatus),
    );
  }

  if (status === 'carregando') {
    return (
      <Screen align="center">
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando usuário" />
        </Column>
      </Screen>
    );
  }

  if (status === 'erro' || !usuario) {
    return (
      <Screen align="center">
        <EmptyState
          title="Não foi possível carregar"
          description={erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      </Screen>
    );
  }

  const perfilMudou = perfilSelecionadoId !== usuario.perfil.id;

  return (
    <Screen>
      <Column gap="xs" align="start">
        <Text variant="heading">{usuario.nome}</Text>
        <Text tone="body">{usuario.email}</Text>
        <Badge label={rotuloStatus[usuario.status]} />
      </Column>

      {ehOProprioUsuario ? (
        <Text tone="body">Você não pode alterar o próprio perfil nem bloquear a si mesmo.</Text>
      ) : (
        <Column gap="sm">
          <Text variant="subheading">Perfil</Text>
          <Column gap="xs">
            {perfis.map((perfil) => {
              const selecionado = perfil.id === perfilSelecionadoId;
              return (
                <ListItem
                  key={perfil.id}
                  accessibilityLabel={`Perfil ${rotuloPerfil[perfil.nome]}`}
                  onPress={() => setPerfilSelecionadoId(perfil.id)}
                >
                  <Column direction="row" gap="sm" wrap>
                    <Text weight={selecionado ? 'medium' : 'regular'}>{rotuloPerfil[perfil.nome]}</Text>
                    {/* O texto do chip indica a seleção: cor nunca é o único indicador. */}
                    {selecionado && <Badge label="Selecionado" />}
                  </Column>
                </ListItem>
              );
            })}
          </Column>
          {/* Único elemento cyan preenchido da tela: a ação primária (DESIGN_CYAN §1). */}
          <Button
            label="Salvar perfil"
            onPress={handleSalvarPerfil}
            disabled={!perfilMudou || acaoEmAndamento !== null}
            loading={acaoEmAndamento === 'perfil'}
          />
        </Column>
      )}

      <Column gap="sm">
        {usuario.status !== 'Ativo' && (
          <Button
            label="Aprovar"
            variant="ghost"
            onPress={() => handleAlterarStatus('Ativo')}
            disabled={acaoEmAndamento !== null}
            loading={acaoEmAndamento === 'aprovar'}
          />
        )}
        {usuario.status === 'Ativo' && !ehOProprioUsuario && (
          <Button
            label="Bloquear"
            variant="ghost"
            onPress={() => handleAlterarStatus('Bloqueado')}
            disabled={acaoEmAndamento !== null}
            loading={acaoEmAndamento === 'bloquear'}
          />
        )}
      </Column>

      {feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />}
    </Screen>
  );
}
