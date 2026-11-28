import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { formatarPlaca } from '@/features/veiculos/placa';
import { diasEntre, hojeISO, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  AvisoSemInternet,
  Button,
  Card,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  TituloSecao,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { concluirManutencao, listarManutencoes } from './manutencaoRepository';
import type { ManutencaoComPlaca, VeiculoResumo } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function titulo(manutencao: ManutencaoComPlaca): string {
  return `${formatarPlaca(manutencao.placa)} · ${manutencao.descricao}`;
}

// Situação em texto, nunca só por cor (CLAUDE.md §8). Aberta já é dita pelo grupo "Em aberto" e pelo botão
// Concluir, e a linha fica sem cortar ao lado dele; concluída diz "Concluída", porque a que acabou de ser
// concluída continua no grupo de cima até a próxima carga.
function subtitulo(manutencao: ManutencaoComPlaca): string {
  const base = `${isoParaDataBR(manutencao.data_manutencao)} · ${formatarMoeda(manutencao.valorCentavos)}`;
  return manutencao.data_conclusao === null ? base : `${base} · Concluída`;
}

// A RPC devolve o status final do veículo, e o texto conta o que aconteceu com ele.
function mensagemDeConclusao(status: VeiculoResumo['status']): string {
  if (status === 'Disponivel') return 'Manutenção concluída. Veículo disponível.';
  if (status === 'EmManutencao') return 'Manutenção concluída. O veículo segue em manutenção por outra ordem aberta.';
  // Veículo inativado no meio do caminho continua Inativo (a RPC não mexe nele): o texto não
  // afirma nada sobre o veículo.
  return 'Manutenção concluída.';
}

// Cabeçalhos e manutenções numa FlatList só, como nas outras listas do redesign.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'manutencao'; id: string; manutencao: ManutencaoComPlaca };

// "aberta há 4 dias" / "aberta hoje": quanto tempo o caminhão está parado, que é o que o gestor quer saber.
function tempoAberta(dataManutencao: string, hoje: string): string {
  const dias = diasEntre(dataManutencao, hoje);
  if (dias <= 0) return 'aberta hoje';
  return dias === 1 ? 'aberta há 1 dia' : `aberta há ${dias} dias`;
}

// O cartão de destaque: quantos caminhões estão parados agora e há quanto tempo o mais antigo espera.
function ResumoDaFrota({ abertas }: { abertas: ManutencaoComPlaca[] }) {
  const placas = [...new Set(abertas.map((manutencao) => formatarPlaca(manutencao.placa)))];
  const hoje = hojeISO();
  // A mais antiga: as abertas chegam em qualquer ordem de data, então compara as datas (AAAA-MM-DD).
  const maisAntiga = abertas.reduce<ManutencaoComPlaca | undefined>(
    (atual, manutencao) => (!atual || manutencao.data_manutencao < atual.data_manutencao ? manutencao : atual),
    undefined,
  );

  return (
    <Card variant="feature">
      <Text variant="bodySm" tone="body">
        Em manutenção
      </Text>
      <Text variant="display" weight="semibold">
        {placas.length === 0 ? 'Nenhum veículo' : placas.length === 1 ? '1 veículo' : `${placas.length} veículos`}
      </Text>
      <Text tone="body">
        {maisAntiga
          ? `${placas.join(', ')} · ${tempoAberta(maisAntiga.data_manutencao, hoje)}`
          : 'Toda a frota está fora da oficina.'}
      </Text>
    </Card>
  );
}

export function ManutencoesListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar do cadastro, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarManutencoes);
  // Um conjunto, não um id só: com duas linhas concluindo ao mesmo tempo, a resposta da primeira
  // não pode tirar o loading da segunda (nem liberar de novo o botão da primeira antes da hora).
  const [concluindo, setConcluindo] = useState<ReadonlySet<string>>(new Set());
  // Conclusões feitas nesta tela (id → quando). Uma recarga que saiu antes da RPC pode chegar
  // depois dela com a linha ainda em aberto; a marca local vale até o banco devolver a conclusão.
  const [concluidasAqui, setConcluidasAqui] = useState<Readonly<Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const coluna = useScreenColumn();

  async function handleConcluir(manutencao: ManutencaoComPlaca) {
    setConcluindo((atuais) => new Set(atuais).add(manutencao.id));
    const resultado = await concluirManutencao(manutencao.id);
    setConcluindo((atuais) => {
      const restantes = new Set(atuais);
      restantes.delete(manutencao.id);
      return restantes;
    });

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    setConcluidasAqui((atuais) => ({ ...atuais, [manutencao.id]: new Date().toISOString() }));
    setFeedback({ mensagem: mensagemDeConclusao(resultado.data), tone: 'success' });
  }

  // A linha fica onde está, marcada como concluída: mudá-la de lugar logo após o toque faria a
  // lista "pular". Na próxima carga ela vai para o grupo das concluídas.
  const manutencoes = (tela.dados ?? []).map((item) => {
    const concluidaEm = concluidasAqui[item.id];
    return item.data_conclusao === null && concluidaEm ? { ...item, data_conclusao: concluidaEm } : item;
  });

  // Os grupos vêm do que o banco devolveu, não da marca local: a linha concluída agora fica no lugar,
  // como "Concluída", e só muda de grupo na próxima carga (a lista não "pula" sob o dedo).
  const linhas = useMemo(() => {
    const porId = new Map(manutencoes.map((item) => [item.id, item]));
    const originais = tela.dados ?? [];
    const resultado: Linha[] = [];
    const grupos = [
      { id: 'abertas', rotulo: 'Em aberto', itens: originais.filter((item) => item.data_conclusao === null) },
      { id: 'concluidas', rotulo: 'Concluídas', itens: originais.filter((item) => item.data_conclusao !== null) },
    ];
    for (const grupo of grupos) {
      if (grupo.itens.length === 0) continue;
      resultado.push({ tipo: 'grupo', id: `grupo-${grupo.id}`, rotulo: `${grupo.rotulo} · ${grupo.itens.length}` });
      for (const item of grupo.itens) {
        resultado.push({ tipo: 'manutencao', id: item.id, manutencao: porId.get(item.id) ?? item });
      }
    }
    return resultado;
  }, [manutencoes, tela.dados]);
  const abertas = manutencoes.filter((item) => item.data_conclusao === null);

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
      fab={<FAB label="Nova manutenção" onPress={() => router.push('/manutencoes/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        {tela.semInternet && tela.status === 'pronto' && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}

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
      </ScreenColumn>

      {tela.status === 'pronto' && (
        <List
          // No celular a lista fica dentro do respiro lateral da tela: a barra de rolagem do Android
          // aparecia por cima das setas e dos valores das linhas.
          showsVerticalScrollIndicator={false}
          data={linhas}
          keyExtractor={(linha) => linha.id}
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
          ListHeaderComponent={manutencoes.length > 0 ? <ResumoDaFrota abertas={abertas} /> : undefined}
          ListHeaderComponentStyle={styles.cabecalho}
          // Sem ação aqui, porque o FAB "Nova manutenção" já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="manutencoes"
              title="Nenhuma manutenção registrada"
              description="Registre a primeira manutenção para começar."
            />
          }
          renderItem={({ item }) =>
            item.tipo === 'grupo' ? (
              <View style={styles.grupo}>
                <TituloSecao titulo={item.rotulo} />
              </View>
            ) : (
              <ListItem
                icon="manutencoes"
                // Em aberto, a chave fica no tom de alerta: o caminhão está parado por ela. O texto diz o mesmo.
                iconTone={item.manutencao.data_conclusao === null ? 'warning' : 'body'}
                title={titulo(item.manutencao)}
                subtitle={subtitulo(item.manutencao)}
                // Tocar na linha abre o veículo (era o botão "Ver veículo"). Concluir continua à vista nas
                // abertas: é a ação desta tela. Ghost porque o único cyan da tela é o FAB.
                onPress={() => router.push(`/frota/${item.manutencao.veiculo_id}`)}
                accessibilityLabel={`Ver veículo, ${titulo(item.manutencao)}`}
                control={
                  item.manutencao.data_conclusao === null ? (
                    <Button
                      label="Concluir"
                      variant="ghost"
                      loading={concluindo.has(item.manutencao.id)}
                      onPress={() => handleConcluir(item.manutencao)}
                    />
                  ) : undefined
                }
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  cabecalho: {
    paddingBottom: spacing.xs,
  },
  grupo: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
