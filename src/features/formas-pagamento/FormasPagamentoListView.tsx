import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  Input,
  ListItem,
  Screen,
  Skeleton,
  Snackbar,
  Switch,
  colors,
} from '@/ui';

import { definirAtivaFormaPagamento, listarFormasPagamento } from './formasPagamentoRepository';
import { isFormaFixa, type FormaPagamento } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

// Forma fixa (do seed) não muda: o subtítulo explica por que a linha não abre nem tem switch.
function subtitulo(forma: FormaPagamento): string | undefined {
  if (isFormaFixa(forma.nome)) return 'Padrão do sistema';
  return forma.ativa ? undefined : 'Desativada';
}

export function FormasPagamentoListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarFormasPagamento);
  const [busca, setBusca] = useState('');
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleAlternarAtiva(forma: FormaPagamento) {
    setProcessandoId(forma.id);
    const resultado = await definirAtivaFormaPagamento(forma.id, !forma.ativa);
    setProcessandoId(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    tela.atualizarDados((atuais) => atuais.map((item) => (item.id === forma.id ? resultado.data : item)));
    setFeedback({
      mensagem: resultado.data.ativa ? 'Forma de pagamento reativada.' : 'Forma de pagamento desativada.',
      tone: 'success',
    });
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = (tela.dados ?? []).filter((forma) => {
    if (!mostrarDesativadas && !forma.ativa) return false;
    if (!termo) return true;
    return forma.nome.toLowerCase().includes(termo);
  });

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
      fab={<FAB label="Nova forma de pagamento" onPress={() => router.push('/formas-pagamento/nova')} />}
    >
      <Input label="Buscar" placeholder="Buscar por nome" value={busca} onChangeText={setBusca} />

      <Switch label="Mostrar desativadas" value={mostrarDesativadas} onValueChange={setMostrarDesativadas} />

      {tela.status === 'carregando' && (
        <Column gap="sm">
          <Skeleton height="xxl" accessibilityLabel="Carregando formas de pagamento" />
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
          data={filtradas}
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
          // Vazio dentro da lista: o pull-to-refresh funciona até sem forma nenhuma. Sem ação aqui,
          // porque o FAB já está na tela.
          ListEmptyComponent={
            <EmptyState
              title={termo ? 'Nenhuma forma de pagamento encontrada' : 'Nenhuma forma de pagamento cadastrada'}
              description={termo ? 'Tente buscar por outro nome.' : 'Crie a primeira forma de pagamento para começar.'}
            />
          }
          renderItem={({ item }) => {
            const fixa = isFormaFixa(item.nome);
            return (
              <ListItem
                title={item.nome}
                subtitle={subtitulo(item)}
                // A regra das fixas continua: sem edição e sem switch.
                onPress={fixa ? undefined : () => router.push(`/formas-pagamento/${item.id}/editar`)}
                control={
                  fixa ? undefined : (
                    <Switch
                      label="Ativa"
                      accessibilityLabel={`Ativa: ${item.nome}`}
                      value={item.ativa}
                      disabled={processandoId === item.id}
                      onValueChange={() => handleAlternarAtiva(item)}
                    />
                  )
                }
              />
            );
          }}
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
