import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString, Point } from 'geojson';

import { Card, Column, EmptyState, Skeleton, Text, colors, radius, spacing } from '@/ui';

import type { Rota } from '../types';
import { buscarCoordenadas, type Coordenada } from './coordenadas';

// Estilo cinza claro do OpenFreeMap (sem chave), que combina com a paleta stone. Fica numa constante
// única para trocar de provedor de tiles sem mexer na tela (ADR 0005, política de tiles do OSM).
export const ESTILO_MAPA_URL = 'https://tiles.openfreemap.org/styles/positron';

// Zoom em que uma cidade inteira cabe na tela. Só é usado quando origem e destino caem no mesmo
// ponto: aí não existe caixa para enquadrar.
const ZOOM_CIDADE = 10;

// A partir desta largura (tablet ou celular deitado), um mapa 4:3 ficaria alto demais e empurraria o
// resto da tela para baixo; vira 16:9. Abaixo dela, 4:3 dá altura suficiente para ver o trecho.
const LARGURA_TELA_LARGA = 600;

// Borda dos marcadores, a mesma no mapa e na legenda.
const BORDA_MARCADOR = spacing.xs / 2;

type Papel = 'origem' | 'destino' | 'trecho';
type Trecho = FeatureCollection<Point | LineString, { papel: Papel }>;

export type MapaRotaProps = {
  rota: Pick<Rota, 'cidade_origem' | 'uf_origem' | 'cidade_destino' | 'uf_destino'>;
};

function trechoGeoJson(origem: Coordenada, destino: Coordenada): Trecho {
  return {
    type: 'FeatureCollection',
    features: [
      // A linha vem antes dos pontos para os marcadores ficarem por cima dela.
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [origem, destino] }, properties: { papel: 'trecho' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: origem }, properties: { papel: 'origem' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: destino }, properties: { papel: 'destino' } },
    ],
  };
}

// Enquadramento: a caixa [oeste, sul, leste, norte] dos dois pontos, com folga para os marcadores não
// ficarem colados na borda. Mesmo ponto não tem caixa, então centraliza nele.
function vistaInicial(origem: Coordenada, destino: Coordenada) {
  if (origem[0] === destino[0] && origem[1] === destino[1]) {
    return { center: origem, zoom: ZOOM_CIDADE };
  }
  return {
    bounds: [
      Math.min(origem[0], destino[0]),
      Math.min(origem[1], destino[1]),
      Math.max(origem[0], destino[0]),
      Math.max(origem[1], destino[1]),
    ] as [number, number, number, number],
    padding: { top: spacing.xl, right: spacing.xl, bottom: spacing.xl, left: spacing.xl },
  };
}

function mensagemSemCoordenada(cidade: string, uf: string): string {
  return `Não encontramos ${cidade}/${uf} no mapa. Confira o nome da cidade na edição da rota.`;
}

// Mapa de conferência do trecho (EIX-80): origem → destino em linha reta, sem rota por estrada.
// Quem usa decide o resto da tela; este componente nunca bloqueia a tela de detalhe.
export function MapaRota({ rota }: MapaRotaProps) {
  const { width } = useWindowDimensions();
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  // Mudar a tentativa troca a `key` do Map: o mapa nativo é montado de novo ("Tentar novamente").
  const [tentativa, setTentativa] = useState(0);

  const origem = buscarCoordenadas(rota.cidade_origem, rota.uf_origem);
  const destino = buscarCoordenadas(rota.cidade_destino, rota.uf_destino);

  // O GeoJSON só muda quando a rota muda; recriá-lo a cada render faria o MapLibre redesenhar à toa.
  // `buscarCoordenadas` devolve sempre a mesma tupla para a mesma cidade, então a dependência é estável.
  const trecho = useMemo(() => (origem && destino ? trechoGeoJson(origem, destino) : null), [origem, destino]);

  if (!origem || !destino || !trecho) {
    return (
      <Card>
        {!origem && <Text tone="body">{mensagemSemCoordenada(rota.cidade_origem, rota.uf_origem)}</Text>}
        {!destino && <Text tone="body">{mensagemSemCoordenada(rota.cidade_destino, rota.uf_destino)}</Text>}
      </Card>
    );
  }

  if (estado === 'erro') {
    return (
      <Card>
        <EmptyState
          title="Não foi possível carregar o mapa"
          description="Verifique a conexão e tente de novo."
          actionLabel="Tentar novamente"
          onAction={() => {
            setEstado('carregando');
            setTentativa((atual) => atual + 1);
          }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <View testID="mapa-rota-area" style={[styles.area, { aspectRatio: width >= LARGURA_TELA_LARGA ? 16 / 9 : 4 / 3 }]}>
        <Map
          key={tentativa}
          style={styles.mapa}
          mapStyle={ESTILO_MAPA_URL}
          // TextureView em vez do GLSurfaceView padrão: o mapa fica dentro de um cartão que rola com a
          // tela, e a SurfaceView do Android não respeita o recorte dos cantos nem a rolagem.
          androidView="texture"
          // Só conferência: gesto ligado disputaria a rolagem da tela com o dedo.
          dragPan={false}
          touchZoom={false}
          doubleTapZoom={false}
          doubleTapHoldZoom={false}
          touchRotate={false}
          touchPitch={false}
          onDidFinishLoadingMap={() => setEstado('pronto')}
          onDidFailLoadingMap={() => setEstado('erro')}
        >
          <Camera initialViewState={vistaInicial(origem, destino)} />
          <GeoJSONSource id="trecho" data={trecho}>
            <Layer
              id="trecho-linha"
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              layout={{ 'line-cap': 'round' }}
              paint={{ 'line-color': colors.accentEdge, 'line-width': spacing.xs }}
            />
            {/* Origem vazada e destino cheio: a diferença vem da forma, não só da cor. */}
            <Layer
              id="trecho-pontos"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-radius': spacing.sm,
                'circle-color': ['match', ['get', 'papel'], 'origem', colors.surface, colors.accent],
                'circle-stroke-color': colors.accentEdge,
                'circle-stroke-width': BORDA_MARCADOR,
              }}
            />
          </GeoJSONSource>
        </Map>
        {estado === 'carregando' && (
          <View style={[StyleSheet.absoluteFill, styles.carregando]}>
            <Skeleton height="xxl" accessibilityLabel="Carregando mapa" />
          </View>
        )}
      </View>
      {/* Legenda em texto: a cor nunca é o único indicador (DESIGN_CYAN §1). */}
      <Column gap="xs">
        <Column direction="row" gap="sm" align="center">
          <View style={[styles.marcador, styles.marcadorOrigem]} />
          <Text variant="bodySm" tone="body">{`Origem: ${rota.cidade_origem}/${rota.uf_origem}`}</Text>
        </Column>
        <Column direction="row" gap="sm" align="center">
          <View style={[styles.marcador, styles.marcadorDestino]} />
          <Text variant="bodySm" tone="body">{`Destino: ${rota.cidade_destino}/${rota.uf_destino}`}</Text>
        </Column>
      </Column>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Largura toda do cartão e altura pela proporção (RNF02): nada de px fixo.
  area: {
    width: '100%',
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  mapa: {
    flex: 1,
  },
  // Cobre o mapa enquanto os tiles não chegam, para não aparecer um retângulo vazio piscando.
  carregando: {
    justifyContent: 'center',
    padding: spacing.base,
    backgroundColor: colors.surface,
  },
  // Mesmo desenho dos marcadores do mapa, em tamanho de legenda.
  marcador: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
    borderWidth: BORDA_MARCADOR,
    borderColor: colors.accentEdge,
  },
  marcadorOrigem: {
    backgroundColor: colors.surface,
  },
  marcadorDestino: {
    backgroundColor: colors.accent,
  },
});
