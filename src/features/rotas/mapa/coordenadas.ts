import { chaveCidade } from '../cidade';
import type { Uf } from '../types';

import municipiosJson from './municipios.json';

// Ordem do GeoJSON e do MapLibre: longitude primeiro.
export type Coordenada = [longitude: number, latitude: number];

// Formato gerado por `gerarMunicipios.mjs`: { UF: [[nome, latitude, longitude], ...] }.
// O cast é seguro porque o arquivo é gerado pelo script e versionado; o TypeScript só não consegue
// inferir a tupla a partir do JSON. Os testes de coordenadas.test.ts leem o arquivo real.
type Municipio = [nome: string, latitude: number, longitude: number];
const municipios = municipiosJson as unknown as Record<Uf, Municipio[]>;

// Índice por UF montado só na primeira busca daquele estado: o app nunca percorre os 5.571
// municípios de uma vez, e a segunda rota do mesmo estado não refaz o trabalho.
const indicePorUf = new Map<Uf, Map<string, Coordenada>>();

function indiceDaUf(uf: Uf): Map<string, Coordenada> {
  let indice = indicePorUf.get(uf);
  if (!indice) {
    indice = new Map((municipios[uf] ?? []).map(([nome, latitude, longitude]) => [chaveCidade(nome), [longitude, latitude]]));
    indicePorUf.set(uf, indice);
  }
  return indice;
}

// Mesma comparação do índice `rota_trecho_unico` (chaveCidade = normaliza_cidade do banco): a cidade
// gravada como "sao paulo" acha São Paulo. Cidade fora do dataset devolve null, e a tela explica.
export function buscarCoordenadas(cidade: string, uf: Uf): Coordenada | null {
  return indiceDaUf(uf).get(chaveCidade(cidade)) ?? null;
}
