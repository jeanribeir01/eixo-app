import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

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
  Text,
  colors,
  spacing,
  useScreenColumn,
} from '@/ui';

import { chaveCidade } from './cidade';
import { definirAtivaRota, listarRotas } from './rotasRepository';
import type { Rota, RotaComViagens } from './types';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

function trecho(rota: Rota): string {
  return `${rota.cidade_origem}/${rota.uf_origem} → ${rota.cidade_destino}/${rota.uf_destino}`;
}

function subtitulo(rota: RotaComViagens): string {
  // Mesmo formato da capacidade em Veículos: vírgula decimal e até 2 casas ("408,5 km").
  const distancia = `${rota.distancia_estimada_km.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
  const viagens =
    rota.viagens_finalizadas === 1 ? '1 viagem finalizada' : `${rota.viagens_finalizadas} viagens finalizadas`;
  const texto = `${distancia} · ${viagens}`;
  return rota.ativa ? texto : `${texto} · Inativa`;
}

// Cabeçalhos e rotas numa FlatList só, como nas outras listas do redesign.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'rota'; id: string; rota: RotaComViagens };

// Com as inativas à mostra, elas ficam num grupo próprio, depois das ativas; sem elas, um grupo só.
function agruparPorSituacao(rotas: RotaComViagens[]): Linha[] {
  const grupos = [
    { id: 'ativas', rotulo: 'Ativas', itens: rotas.filter((rota) => rota.ativa) },
    { id: 'inativas', rotulo: 'Inativas', itens: rotas.filter((rota) => !rota.ativa) },
  ];
  const linhas: Linha[] = [];
  for (const grupo of grupos) {
    if (grupo.itens.length === 0) continue;
    linhas.push({ tipo: 'grupo', id: `grupo-${grupo.id}`, rotulo: `${grupo.rotulo} · ${grupo.itens.length}` });
    for (const rota of grupo.itens) linhas.push({ tipo: 'rota', id: rota.id, rota });
  }
  return linhas;
}

export function RotasListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarRotas);
  const [busca, setBusca] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const coluna = useScreenColumn();

  async function handleAlternarAtiva(rota: RotaComViagens) {
    setProcessandoId(rota.id);
    const resultado = await definirAtivaRota(rota.id, !rota.ativa);
    setProcessandoId(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    // O repositório devolve a rota sem a contagem: mantém a que já estava na tela.
    tela.atualizarDados((atuais) =>
      atuais.map((item) => (item.id === rota.id ? { ...resultado.data, viagens_finalizadas: item.viagens_finalizadas } : item)),
    );
    setFeedback({ mensagem: resultado.data.ativa ? 'Rota reativada.' : 'Rota inativada.', tone: 'success' });
  }

  // Busca local (catálogo pequeno): `chaveCidade` ignora maiúscula, espaço e acento, então
  // "sao" encontra "São Paulo" — a mesma regra que o banco usa para rota duplicada.
  const termo = chaveCidade(busca);
  const rotasFiltradas = (tela.dados ?? []).filter((rota) => {
    if (!mostrarInativas && !rota.ativa) return false;
    if (!termo) return true;
    return chaveCidade(rota.cidade_origem).includes(termo) || chaveCidade(rota.cidade_destino).includes(termo);
  });

  const linhas = useMemo(() => agruparPorSituacao(rotasFiltradas), [rotasFiltradas]);

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
      fab={<FAB label="Nova rota" onPress={() => router.push('/rotas/nova')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <Input label="Buscar rota" icone="buscar" placeholder="Cidade de origem ou destino" value={busca} onChangeText={setBusca} />

        <Switch label="Mostrar inativas" value={mostrarInativas} onValueChange={setMostrarInativas} />

        {tela.status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando rotas" />
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
          // Vazio dentro da lista: o pull-to-refresh funciona até sem rota. Sem ação aqui,
          // porque o FAB "Nova rota" já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="rotas"
              title={termo ? 'Nenhuma rota encontrada' : 'Nenhuma rota cadastrada'}
              description={termo ? 'Tente buscar por outra cidade.' : 'Cadastre o primeiro trecho para começar.'}
            />
          }
          renderItem={({ item }) =>
            item.tipo === 'grupo' ? (
              <View style={styles.grupo}>
                <Text weight="semibold" accessibilityRole="header">
                  {item.rotulo}
                </Text>
              </View>
            ) : (
              <ListItem
                icon="rotas"
                title={trecho(item.rota)}
                subtitle={subtitulo(item.rota)}
                onPress={() => router.push(`/rotas/${item.rota.id}/editar`)}
                control={
                  <Switch
                    label="Ativa"
                    accessibilityLabel={`Ativa: ${trecho(item.rota)}`}
                    value={item.rota.ativa}
                    disabled={processandoId === item.rota.id}
                    onValueChange={() => handleAlternarAtiva(item.rota)}
                  />
                }
              />
            )
          }
          // O que o interruptor "Ativa" faz, dito uma vez no fim da lista e não em cada linha.
          ListFooterComponent={
            linhas.length > 0 ? (
              <Text variant="bodySm" tone="body" style={styles.rodape}>
                Inativar uma rota tira o trecho das novas viagens e preserva o histórico.
              </Text>
            ) : undefined
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
  grupo: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  rodape: {
    paddingTop: spacing.lg,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
