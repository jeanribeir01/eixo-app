import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { rotuloPerfil, rotuloStatus, tomPerfil, type StatusUsuario } from '@/features/auth/permissions';
import { useProfile } from '@/features/auth/profileStore';
import { useCargaUnica } from '@/lib/useCargaUnica';
import {
  Avatar,
  Badge,
  type BadgeTone,
  Button,
  Column,
  EmptyState,
  type IconName,
  OpcaoSelecionavel,
  Screen,
  Snackbar,
  Text,
  TituloSecao,
  colors,
  spacing,
} from '@/ui';

import type { Perfil, Usuario } from './types';
import {
  alterarPerfilUsuario,
  alterarStatusUsuario,
  buscarUsuarioPorId,
  listarPerfis,
  type Resultado,
} from './usuariosRepository';

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

// Usuário e perfis saem juntos; qualquer falha vira o erro da tela. Os perfis vêm na ordem de privilégio.
async function buscarUsuarioEPerfis(id: string): Promise<Resultado<{ usuario: Usuario; perfis: Perfil[] }>> {
  const [resultadoUsuario, resultadoPerfis] = await Promise.all([buscarUsuarioPorId(id), listarPerfis()]);
  if (!resultadoUsuario.ok) return resultadoUsuario;
  if (!resultadoPerfis.ok) return resultadoPerfis;
  const perfis = [...resultadoPerfis.data].sort((a, b) => ORDEM_PERFIS.indexOf(a.nome) - ORDEM_PERFIS.indexOf(b.nome));
  return { ok: true, data: { usuario: resultadoUsuario.data, perfis } };
}

export function UsuarioDetalheView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { usuario: usuarioLogado } = useProfile();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState<string | null>(null);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<Acao | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Carga única (useCargaUnica): o seletor de perfil começa no perfil gravado e não volta para ele
  // sozinho. Sem internet a tela diz isso na hora e tenta de novo quando a conexão volta.
  const buscar = useCallback(() => buscarUsuarioEPerfis(id), [id]);
  const { status, erro, tentarDeNovo } = useCargaUnica(buscar, (dados) => {
    setUsuario(dados.usuario);
    setPerfilSelecionadoId(dados.usuario.perfil.id);
    setPerfis(dados.perfis);
  });

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
          onAction={tentarDeNovo}
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
          <Badge label={rotuloPerfil[usuario.perfil.nome]} tone={tomPerfil[usuario.perfil.nome]} />
          <Badge label={rotuloStatus[usuario.status]} tone={TOM_DO_STATUS[usuario.status]} />
        </Column>
      </Column>

      {ehOProprioUsuario ? (
        <Text tone="body">Você não pode alterar o próprio perfil nem bloquear a si mesmo.</Text>
      ) : (
        <Column gap="sm">
          <TituloSecao titulo="Perfil de acesso" />
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
