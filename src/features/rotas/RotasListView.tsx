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

export function RotasListView() {
  const router = useRouter();
  // Carrega ao abrir e ao voltar da criação/edição, sem a lista piscar (EIX-63).
  const tela = useDadosDaTela(listarRotas);
  const [busca, setBusca] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

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
      fab={<FAB label="Nova rota" onPress={() => router.push('/rotas/nova')} />}
    >
      <Input label="Buscar" placeholder="Buscar por cidade" value={busca} onChangeText={setBusca} />

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

      {tela.status === 'pronto' && (
        <FlatList
          data={rotasFiltradas}
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
          // Vazio dentro da lista: o pull-to-refresh funciona até sem rota. Sem ação aqui,
          // porque o FAB "Nova rota" já está na tela.
          ListEmptyComponent={
            <EmptyState
              icon="rotas"
              title={termo ? 'Nenhuma rota encontrada' : 'Nenhuma rota cadastrada'}
              description={termo ? 'Tente buscar por outra cidade.' : 'Cadastre o primeiro trecho para começar.'}
            />
          }
          renderItem={({ item }) => (
            <ListItem
              title={trecho(item)}
              subtitle={subtitulo(item)}
              // Abre o detalhe com o mapa (EIX-80); a edição fica no botão "Editar" de lá.
              onPress={() => router.push(`/rotas/${item.id}`)}
              control={
                <Switch
                  label="Ativa"
                  accessibilityLabel={`Ativa: ${trecho(item)}`}
                  value={item.ativa}
                  disabled={processandoId === item.id}
                  onValueChange={() => handleAlternarAtiva(item)}
                />
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
