import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { rotuloPerfil, rotuloStatus, type StatusUsuario } from '@/features/auth/permissions';
import { useProfile } from '@/features/auth/profileStore';
import {
  Avatar,
  Badge,
  Button,
  Column,
  EmptyState,
  OpcaoSelecionavel,
  Screen,
  Snackbar,
  Text,
  colors,
  spacing,
  type BadgeTone,
  type IconName,
} from '@/ui';

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

// O que cada perfil libera, dito na própria opção: o Admin escolhe pela consequência, não pelo nome.
const DESCRICAO_PERFIL: Record<Perfil['nome'], { descricao: string; icone: IconName }> = {
  Admin: { descricao: 'Tudo, inclusive aprovar e bloquear usuários', icone: 'usuarios' },
  Financeiro: { descricao: 'Caixa, dívidas, categorias e relatórios financeiros', icone: 'financeiro' },
  'Gestor de Frota': { descricao: 'Veículos, rotas, viagens e manutenções', icone: 'frota' },
  Motorista: { descricao: 'Só as próprias viagens e o hodômetro', icone: 'viagens' },
};

const TOM_DO_STATUS: Record<StatusUsuario, BadgeTone> = {
  Ativo: 'success',
  AguardandoAprovacao: 'warning',
  Bloqueado: 'danger',
};

// Ordem de privilégio, do maior para o menor, para a lista de escolha ler de cima para baixo.
const ORDEM_PERFIS: Perfil['nome'][] = ['Admin', 'Financeiro', 'Gestor de Frota', 'Motorista'];

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
    const mensagem = !aprovar ? 'Usuário bloqueado.' : usuario?.status === 'Bloqueado' ? 'Usuário desbloqueado.' : 'Usuário aprovado.';
    executar(aprovar ? 'aprovar' : 'bloquear', mensagem, () =>
      alterarStatusUsuario(id, novoStatus),
    );
  }

  if (status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accentStrong} accessibilityLabel="Carregando usuário" />
        </Column>
      </Screen>
    );
  }

  if (status === 'erro' || !usuario) {
    return (
      <Screen align="center" underHeader>
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
  const primeiroNome = usuario.nome.trim().split(/\s+/)[0];

  return (
    <Screen
      underHeader
      scroll
      overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />}
    >
      <Column gap="sm" align="center">
        <Avatar name={usuario.nome} photoUrl={null} />
        <Text variant="heading" accessibilityRole="header">
          {usuario.nome}
        </Text>
        <Text tone="body">{usuario.email}</Text>
        <Column direction="row" gap="sm" align="center">
          <Badge label={rotuloPerfil[usuario.perfil.nome]} tone="muted" />
          <Badge label={rotuloStatus[usuario.status]} tone={TOM_DO_STATUS[usuario.status]} />
        </Column>
      </Column>

      {ehOProprioUsuario ? (
        <Text tone="body">Você não pode alterar o próprio perfil nem bloquear a si mesmo.</Text>
      ) : (
        <Column gap="sm">
          <Text variant="title" weight="semibold" accessibilityRole="header">
            Perfil de acesso
          </Text>
          <View accessibilityRole="radiogroup" style={styles.opcoes}>
            {perfis.map((perfil) => (
              <OpcaoSelecionavel
                key={perfil.id}
                titulo={rotuloPerfil[perfil.nome]}
                descricao={DESCRICAO_PERFIL[perfil.nome].descricao}
                icon={DESCRICAO_PERFIL[perfil.nome].icone}
                selecionada={perfil.id === perfilSelecionadoId}
                onPress={() => setPerfilSelecionadoId(perfil.id)}
                disabled={acaoEmAndamento !== null}
              />
            ))}
          </View>
          {/* Único elemento azul preenchido da tela: a ação primária (DESIGN_CYAN §1). */}
          <Button
            label="Salvar perfil"
            onPress={handleSalvarPerfil}
            disabled={!perfilMudou || acaoEmAndamento !== null}
            loading={acaoEmAndamento === 'perfil'}
          />
        </Column>
      )}

      <Column gap="sm">
        {usuario.status === 'AguardandoAprovacao' && (
          <Button
            label="Aprovar acesso"
            variant="ghost"
            onPress={() => handleAlterarStatus('Ativo')}
            disabled={acaoEmAndamento !== null}
            loading={acaoEmAndamento === 'aprovar'}
          />
        )}
        {usuario.status === 'Bloqueado' && (
          <Button
            label="Desbloquear acesso"
            variant="ghost"
            onPress={() => handleAlterarStatus('Ativo')}
            disabled={acaoEmAndamento !== null}
            loading={acaoEmAndamento === 'aprovar'}
          />
        )}
        {usuario.status !== 'Bloqueado' && !ehOProprioUsuario && (
          <>
            <Button
              label="Bloquear acesso"
              variant="danger"
              onPress={() => handleAlterarStatus('Bloqueado')}
              disabled={acaoEmAndamento !== null}
              loading={acaoEmAndamento === 'bloquear'}
            />
            <Text variant="bodySm" tone="body">
              {`Bloqueado, ${primeiroNome} perde o acesso ao app. Dá para desbloquear depois.`}
            </Text>
          </>
        )}
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opcoes: {
    gap: spacing.sm,
  },
});
