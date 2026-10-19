import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useDadosDaTela } from '@/lib/useDadosDaTela';
import { Button, Card, Column, EmptyState, Screen, Snackbar, Text, colors } from '@/ui';

import { MapaRota } from './mapa/MapaRota';
import { buscarRotaPorId } from './rotasRepository';
import type { Rota } from './types';

// Mesmo formato da lista de rotas: vírgula decimal e até 2 casas ("408,5 km").
function distancia(rota: Rota): string {
  const texto = `${rota.distancia_estimada_km.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
  return rota.ativa ? texto : `${texto} · Inativa`;
}

// Detalhe da rota (EIX-80): o trecho, a distância e o mapa de conferência. Quem quer mudar a rota
// toca em "Editar"; o detalhe não edita nada.
export function RotaDetalheView({ id }: { id: string }) {
  const router = useRouter();
  // useDadosDaTela recarrega quando a tela volta ao foco: quem volta da edição vê o trecho e o mapa novos.
  const buscar = useCallback(() => buscarRotaPorId(id), [id]);
  const tela = useDadosDaTela(buscar);

  if (tela.status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando rota" />
      </Screen>
    );
  }

  if (tela.status === 'erro' || !tela.dados) {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
      </Screen>
    );
  }

  const rota = tela.dados;

  return (
    // O título "Rota" fica no header; o trecho aparece no cartão porque é dado, não título.
    <Screen
      underHeader
      scroll
      overlay={
        tela.feedbackErro && <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
      }
    >
      <Column gap="lg">
        <Card>
          <Column gap="xs">
            <Text variant="subheading">{`${rota.cidade_origem}/${rota.uf_origem} → ${rota.cidade_destino}/${rota.uf_destino}`}</Text>
            <Text tone="body">{distancia(rota)}</Text>
          </Column>
          {/* Ghost: o único cyan preenchido da tela é o marcador de destino no mapa (DESIGN_CYAN §1). */}
          <Button label="Editar" variant="ghost" onPress={() => router.push(`/rotas/${rota.id}/editar`)} />
        </Card>
        {/* A key remonta o mapa quando o trecho muda depois de uma edição. */}
        <MapaRota key={`${rota.cidade_origem}/${rota.uf_origem}-${rota.cidade_destino}/${rota.uf_destino}`} rota={rota} />
      </Column>
    </Screen>
  );
}
