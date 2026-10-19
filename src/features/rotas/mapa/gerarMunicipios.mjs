// Gera `municipios.json` (EIX-80, ADR 0005) a partir do dataset kelvins/Municipios-Brasileiros (MIT,
// licença em `municipios.LICENSE`). Rode só quando o IBGE criar município novo:
//
//   curl -LO https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv
//   curl -LO https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/estados.csv
//   node src/features/rotas/mapa/gerarMunicipios.mjs municipios.csv estados.csv
//
// O original tem 9 colunas (1,5 MB em JSON). O app só precisa de nome, latitude e longitude, então o
// arquivo gerado guarda `{ UF: [[nome, latitude, longitude], ...] }` (~190 KB). Agrupar por UF deixa
// a busca olhar só as cidades do estado da rota.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [caminhoMunicipios, caminhoEstados] = process.argv.slice(2);
if (!caminhoMunicipios || !caminhoEstados) {
  console.error('Uso: node gerarMunicipios.mjs <municipios.csv> <estados.csv>');
  process.exit(1);
}

// Os CSVs do kelvins não têm vírgula dentro de campo (nem aspas). Se um dia tiverem, a contagem de
// colunas abaixo falha em vez de gerar coordenada errada.
function lerCsv(caminho, colunas) {
  const linhas = readFileSync(caminho, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
  return linhas.map((linha, indice) => {
    const campos = linha.split(',');
    if (campos.length !== colunas) {
      throw new Error(`${caminho}, linha ${indice + 2}: esperava ${colunas} colunas, veio ${campos.length}`);
    }
    return campos;
  });
}

// estados.csv: codigo_uf, uf, nome, latitude, longitude, regiao
const ufPorCodigo = new Map(lerCsv(caminhoEstados, 6).map(([codigo, uf]) => [codigo, uf]));

// municipios.csv: codigo_ibge, nome, latitude, longitude, capital, codigo_uf, siafi_id, ddd, fuso_horario
const porUf = {};
for (const [, nome, latitude, longitude, , codigoUf] of lerCsv(caminhoMunicipios, 9)) {
  const uf = ufPorCodigo.get(codigoUf);
  if (!uf) throw new Error(`UF desconhecida (codigo_uf ${codigoUf}) em ${nome}`);
  (porUf[uf] ??= []).push([nome, Number(latitude), Number(longitude)]);
}

const ordenado = Object.fromEntries(Object.keys(porUf).sort().map((uf) => [uf, porUf[uf]]));
const destino = join(dirname(fileURLToPath(import.meta.url)), 'municipios.json');
writeFileSync(destino, JSON.stringify(ordenado));

const total = Object.values(ordenado).reduce((soma, cidades) => soma + cidades.length, 0);
console.log(`${destino}: ${Object.keys(ordenado).length} UFs, ${total} municípios`);
