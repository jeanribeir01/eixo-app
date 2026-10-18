import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { formatarPlaca } from '@/features/veiculos/placa';
import { isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Button,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  ListItem,
  Screen,
  Skeleton,
  Snackbar,
  colors,
} from '@/ui';

import { concluirManutencao, listarManutencoes } from './manutencaoRepository';
import type { ManutencaoComPlaca, VeiculoResumo } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function titulo(manutencao: ManutencaoComPlaca): string {
  return `${formatarPlaca(manutencao.placa)} · ${manutencao.descricao}`;
}

// Situação em texto, nunca só por cor (CLAUDE.md §8).
function subtitulo(manutencao: ManutencaoComPlaca): string {
  const situacao = manutencao.data_conclusao === null ? 'Em aberto' : 'Concluída';
  return `${isoParaDataBR(manutencao.data_manutencao)} · ${formatarMoeda(manutencao.valorCentavos)} · ${situacao}`;
}

// A RPC devolve o status final do veículo, e o texto conta o que aconteceu com ele.
function mensagemDeConclusao(status: VeiculoResumo['status']): string {
  if (status === 'Disponivel') return 'Manutenção concluída. Veículo disponível.';
  if (status === 'EmManutencao') return 'Manutenção concluída. O veículo segue em manutenção por outra ordem aberta.';
  // Veículo inativado no meio do caminho continua Inativo (a RPC não mexe nele): o texto não
  // afirma nada sobre o veículo.
  return 'Manutenção concluída.';
}

export function ManutencoesListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar do cadastro, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarManutencoes);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleConcluir(manutencao: ManutencaoComPlaca) {
    setConcluindoId(manutencao.id);
    const resultado = await concluirManutencao(manutencao.id);
    setConcluindoId(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    // A linha fica onde está, marcada como concluída: mudá-la de lugar logo após o toque faria a
    // lista "pular". Na próxima carga ela vai para o grupo das concluídas.
    const concluidaEm = new Date().toISOString();
    tela.atualizarDados((atuais) =>
      atuais.map((item) => (item.id === manutencao.id ? { ...item, data_conclusao: concluidaEm } : item)),
    );
    setFeedback({ mensagem: mensagemDeConclusao(resultado.data), tone: 'success' });
  }

  // Um Snackbar só: o retorno da ação vem antes do aviso de recarga que falhou.
  const snackbar = feedback ?? (tela.feedbackErro ? { mensagem: tela.feedbackErro, tone: 'error' as const } : null);

  return (
    <Screen
      underHeader
      overlay={
        snackbar && (
          <Snackbar
            message={snackbar.mensagem}
            tone={snackbar.tone}
            onDismiss={() => (feedback ? setFeedback(null) : tela.limparFeedbackErro())}
          />
        )
      }
      // O FAB é a ação de criar e o único cyan da tela (DESIGN_CYAN §7).
      fab={<FAB label="Nova manutenção" onPress={() => router.push('/manutencoes/nova')} />}
    >
      {tela.status === 'carregando' && (
        <Column gap="sm">
          <Skeleton height="xxl" accessibilityLabel="Carregando manutenções" />
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
          contentContainerStyle={styles.espacoDoFab}
          refreshControl={
            <RefreshControl
              refreshing={tela.atualizando}
              onRefresh={tela.puxarParaAtualizar}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
          // Sem ação aqui, porque o FAB "Nova manutenção" já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="manutencoes"
              title="Nenhuma manutenção registrada"
              description="Registre a primeira manutenção para começar."
            />
          }
          renderItem={({ item }) => (
            <ListItem
              title={titulo(item)}
              subtitle={subtitulo(item)}
              // As duas ações ficam no controle, fora de uma área de toque da linha: o leitor de tela
              // alcança cada botão separado, e cada um tem o alvo de 44pt do Button. Ghost porque o
              // único cyan da tela é o FAB.
              control={
                <Column gap="xs">
                  {item.data_conclusao === null && (
                    <Button
                      label="Concluir"
                      variant="ghost"
                      loading={concluindoId === item.id}
                      onPress={() => handleConcluir(item)}
                    />
                  )}
                  <Button label="Ver veículo" variant="ghost" onPress={() => router.push(`/frota/${item.veiculo_id}`)} />
                </Column>
              }
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
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
