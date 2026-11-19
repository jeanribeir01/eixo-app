import { memo, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, type ListRenderItemInfo } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  List,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  Input,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Switch,
  colors,
  useScreenColumn,
} from '@/ui';

import { definirAtivaFormaPagamento, listarFormasPagamento } from './formasPagamentoRepository';
import { isFormaFixa, type FormaPagamento } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

// Forma fixa (do seed) não muda: o subtítulo explica por que a linha não abre nem tem switch.
function subtitulo(forma: FormaPagamento): string | undefined {
  if (isFormaFixa(forma.nome)) return 'Padrão do sistema';
  return forma.ativa ? undefined : 'Desativada';
}

type LinhaProps = {
  forma: FormaPagamento;
  // Booleano, não o id em processamento: só a linha cujo switch mudou re-renderiza.
  processando: boolean;
  onAbrir: (id: string) => void;
  onAlternarAtiva: (forma: FormaPagamento) => void;
};

// Linha memoizada (EIX-71): digitar na busca re-renderiza a tela a cada letra; com memo, só as linhas
// que entram ou saem do filtro renderizam. Por isso os callbacks do pai são estáveis (useCallback).
const FormaPagamentoLinha = memo(function FormaPagamentoLinha({
  forma,
  processando,
  onAbrir,
  onAlternarAtiva,
}: LinhaProps) {
  const fixa = isFormaFixa(forma.nome);
  return (
    <ListItem
      title={forma.nome}
      subtitle={subtitulo(forma)}
      // A regra das fixas continua: sem edição e sem switch.
      onPress={fixa ? undefined : () => onAbrir(forma.id)}
      control={
        fixa ? undefined : (
          <Switch
            label="Ativa"
            accessibilityLabel={`Ativa: ${forma.nome}`}
            value={forma.ativa}
            disabled={processando}
            onValueChange={() => onAlternarAtiva(forma)}
          />
        )
      }
    />
  );
});

// Fora do componente: a mesma função em todo render, sem precisar de useCallback.
function chaveDaForma(forma: FormaPagamento): string {
  return forma.id;
}

export function FormasPagamentoListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarFormasPagamento);
  const { atualizarDados } = tela;
  const [busca, setBusca] = useState('');
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const coluna = useScreenColumn();

  const handleAlternarAtiva = useCallback(
    async (forma: FormaPagamento) => {
      setProcessandoId(forma.id);
      const resultado = await definirAtivaFormaPagamento(forma.id, !forma.ativa);
      setProcessandoId(null);

      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }

      atualizarDados((atuais) => atuais.map((item) => (item.id === forma.id ? resultado.data : item)));
      setFeedback({
        mensagem: resultado.data.ativa ? 'Forma de pagamento reativada.' : 'Forma de pagamento desativada.',
        tone: 'success',
      });
    },
    [atualizarDados],
  );

  const abrir = useCallback((id: string) => router.push(`/formas-pagamento/${id}/editar`), [router]);

  const renderLinha = useCallback(
    ({ item }: ListRenderItemInfo<FormaPagamento>) => (
      <FormaPagamentoLinha
        forma={item}
        processando={processandoId === item.id}
        onAbrir={abrir}
        onAlternarAtiva={handleAlternarAtiva}
      />
    ),
    [processandoId, abrir, handleAlternarAtiva],
  );

  const termo = busca.trim().toLowerCase();
  // O useMemo mantém o mesmo array enquanto dados, busca e switch não mudam.
  const filtradas = useMemo(
    () =>
      (tela.dados ?? []).filter((forma) => {
        if (!mostrarDesativadas && !forma.ativa) return false;
        if (!termo) return true;
        return forma.nome.toLowerCase().includes(termo);
      }),
    [tela.dados, mostrarDesativadas, termo],
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
      // O FAB é a ação de criar e o único cyan da tela (DESIGN_CYAN §7).
      fab={<FAB label="Nova forma de pagamento" onPress={() => router.push('/formas-pagamento/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
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
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <List
          data={filtradas}
          keyExtractor={chaveDaForma}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.espacoDoFab]}
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
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
