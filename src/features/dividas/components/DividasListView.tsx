import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';

import { formatarMoeda } from '@/lib/money';
import { Column, EmptyState, FAB, FAB_ALTURA_RESERVADA, ListItem, Screen, Text, colors } from '@/ui';

import { listarDividas } from '../dividasRepository';
import type { Divida } from '../types';

type Status = 'carregando' | 'pronto' | 'erro';

// "3 de 12 parcelas pagas": o progresso da dívida numa linha só, abaixo da descrição.
function rotuloParcelasPagas(divida: Pick<Divida, 'parcelasPagas' | 'quantidadeParcelas'>): string {
  return `${divida.parcelasPagas} de ${divida.quantidadeParcelas} parcelas pagas`;
}

export function DividasListView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  // Cada carga ganha um número; só a mais recente pode escrever na tela (mesmo padrão de Movimentações).
  const ultimoPedido = useRef(0);

  const carregar = useCallback(async () => {
    const pedido = ++ultimoPedido.current;
    setStatus('carregando');
    const resultado = await listarDividas();
    if (pedido !== ultimoPedido.current) return;

    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setDividas(resultado.data);
    setStatus('pronto');
  }, []);

  // Recarrega ao voltar do cadastro: a dívida nova já aparece na lista.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return (
    // O FAB é a ação de criar e o único cyan da tela (DESIGN_CYAN §7).
    <Screen underHeader fab={<FAB label="Nova dívida" onPress={() => router.push('/dividas/nova')} />}>
      {status === 'carregando' && (
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando dívidas" />
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

      {/* Sem ação no estado vazio: o FAB "Nova dívida" já está na tela. */}
      {status === 'pronto' && dividas.length === 0 && (
        <EmptyState
          title="Nenhuma dívida cadastrada"
          description="Cadastre um financiamento para gerar as parcelas no caixa."
        />
      )}

      {status === 'pronto' && dividas.length > 0 && (
        <FlatList
          data={dividas}
          keyExtractor={(divida) => divida.id}
          contentContainerStyle={styles.espacoDoFab}
          renderItem={({ item }) => (
            <ListItem
              title={item.descricao}
              subtitle={rotuloParcelasPagas(item)}
              trailing={<Text weight="medium">{formatarMoeda(item.somaTotalCentavos)}</Text>}
              onPress={() => router.push(`/dividas/${item.id}`)}
              accessibilityLabel={`${item.descricao}, total ${formatarMoeda(item.somaTotalCentavos)}, ${rotuloParcelasPagas(item)}`}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
