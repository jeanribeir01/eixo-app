# ADR 0005 — Mapa da rota: provedor de mapa e origem das coordenadas das cidades

- **Status:** Aceito — **B (MapLibre) + C (IBGE embarcado)**, decidido pelo Diogo e pelo Jean em
  2026-10-18
- **Data:** 2026-10-18 (proposto e aceito)
- **US:** EIX-80 (US07-b), depende da EIX-38 (US07)
- **Decisões relacionadas:** ADR 0004 (offline-first), `.specs/STATE.md` AD-009 e AD-010

## Contexto

A EIX-80 pede um mapa no detalhe da Rota, com marcador de origem, marcador de destino e uma linha
reta entre eles, enquadrando os dois pontos. Rota real por estrada e GPS ao vivo estão fora do
escopo.

O requisito veio de um pedido informal do professor sobre "mapa de rotas" e não está no CLAUDE.md,
nas US01–US18, nos ADRs nem nas specs. Por isso, a primeira etapa foi só o spike (este ADR), sem
dependência instalada nem migration. **Em 2026-10-18 o Jean confirmou com o professor que o
requisito é necessário**, e a task foi liberada.

Duas perguntas ficam para decidir:

1. **Qual provedor de mapa:** `react-native-maps` (Google Maps no Android) ou MapLibre com tiles do
   OpenStreetMap.
2. **De onde vêm as coordenadas das cidades:** uma tabela de municípios do IBGE dentro do app ou um
   serviço de geocodificação.

O que já existe e pesa na decisão:

- `rota` guarda `cidade_origem` e `cidade_destino` como **texto livre**, com UF em enum
  (`20261014000200_rota_uf_ativa.sql`). Não tem latitude nem longitude. A duplicidade ignora acento
  e maiúscula por meio de `normaliza_cidade()` (`20261014000400_rota_trecho_sem_acento.sql`).
- Quando este ADR foi proposto, o formulário e a lista de Rotas ainda eram placeholders. A EIX-38
  (#36) os entregou depois, com a cidade em texto livre e o `Select` de `src/ui/` para as 27 UFs.
  Ela não criou tela de detalhe; a EIX-80 cria uma para o mapa.
- O app roda em **development build** (Expo SDK 57, RN 0.86, New Architecture). `android/` e `ios/`
  são gerados (CNG) e não vão para o Git. Ainda não existe `eas.json`.
- O projeto no Google Cloud já existe por causa do login (ADR 0001), com o package
  `com.eixocerto.app` e o SHA-1 registrados no client OAuth.
- `.env` não é versionado e o `.env.example` lista os nomes das chaves.

## Opções avaliadas

### Pergunta 1 — Provedor de mapa

#### A) `react-native-maps` com Google Maps no Android

**Prós**
- É a biblioteca de mapa mais usada em React Native. A documentação do Expo tem um guia oficial
  dela (`docs.expo.dev/versions/v57.0.0/sdk/map-view`) e há muitos exemplos na internet, o que
  ajuda uma equipe iniciante.
- `Marker`, `Polyline` e `fitToCoordinates` resolvem o critério de aceite com pouco código.
- A versão 1.26 suporta a New Architecture (exige RN ≥ 0.81.1, e o projeto está na 0.86).
- Sem cobrança de uso: o SKU "Mobile Native Dynamic Maps" do Maps SDK for Android custa US$ 0 e o
  uso móvel é ilimitado (página "Usage and Billing" do Google).
- No iOS ele usa o Apple Maps por padrão, sem chave.
- Dá para reaproveitar o projeto do Google Cloud do login e o SHA-1 já levantado.

**Contras**
- **Exige API key.** Mesmo com custo zero, o Google pede uma **conta de faturamento com cartão**
  vinculada ao projeto. Para um time acadêmico, isso pode ser o maior atrito.
- A chave fica restrita ao package e ao SHA-1, e **cada SHA-1 precisa ser cadastrado**: o debug
  keystore de cada dev que gera build local, o keystore do EAS e, se publicar, a assinatura do Play.
  O login já passou por essa dor. Esqueceu um SHA-1, e o mapa aparece cinza, sem mensagem de erro
  clara.
- Mapa padrão do Google é colorido. Para se aproximar da paleta stone do DESIGN_CYAN, precisa de um
  `customMapStyle` em JSON. Isso é opcional, mas é mais um arquivo para manter.

**Como ficaria a chave no fluxo atual**
- `app.config.ts` lê `process.env.GOOGLE_MAPS_API_KEY` e repassa ao plugin `react-native-maps`
  (`androidGoogleMapsApiKey`). **Sem o prefixo `EXPO_PUBLIC_`**: a chave vai para o
  `AndroidManifest` no momento do build, não para o bundle JS.
- Local: a chave entra no `.env` (já ignorado pelo Git) e o nome vai para o `.env.example`.
- EAS: como ainda não há `eas.json`, quando os builds forem pelo EAS a chave vira uma **variável de
  ambiente do EAS** (visibilidade "secret"), e não um arquivo.
- Atenção: a chave **fica legível dentro do APK** de qualquer jeito. Quem protege é a restrição por
  package + SHA-1 no Google Cloud, não o sigilo. Mesmo assim, ela não vai para o Git, para não ser
  reaproveitada por terceiros e não disparar os alertas de segredo do GitHub.

#### B) MapLibre (`@maplibre/maplibre-react-native`) com tiles OpenStreetMap

**Prós**
- **Sem chave e sem conta de faturamento.** Não entra nada no `.env`, no EAS nem no Google Cloud.
- Não depende de SHA-1: build de qualquer dev funciona igual.
- O estilo do mapa é um JSON aberto. Um estilo cinza claro, como o "positron", combina com a
  paleta stone do DESIGN_CYAN sem trabalho extra.
- A v11 é feita para a New Architecture (exige RN ≥ 0.80) e tem config plugin do Expo.
- Projeto open source mantido pela comunidade MapLibre, sem risco de mudança de preço de um
  fornecedor.

**Contras**
- **"Sem chave" não quer dizer "sem fornecedor".** O MapLibre só desenha. Os tiles vêm de algum
  servidor, e cada opção sem chave tem um limite:
  - `tile.openstreetmap.org` (raster): permitido em app, mas sem SLA, pode bloquear sem aviso e
    exige User-Agent próprio do app, cache e atribuição visível. Proíbe baixar tiles para uso
    offline.
  - OpenFreeMap (vetorial, `tiles.openfreemap.org`): sem chave e sem limite declarado, mas mantido
    por doação e "as-is", sem garantia de continuar existindo.
  - `demotiles.maplibre.org`: só para desenvolvimento, segundo a própria documentação.
  - Provedores com SLA (MapTiler, Stadia) voltam a exigir chave.
- Menos exemplos na internet do que o `react-native-maps`. A v11 **renomeou componentes**
  (`MapView` virou `Map`), então tutoriais antigos não funcionam do jeito que estão escritos. É um
  risco real para a equipe.
- Marcador e linha seguem o modelo de *source* + *layer* GeoJSON, que é mais abstrato do que
  `<Marker>` e `<Polyline>`.
- Atribuição "© OpenStreetMap" visível no mapa é obrigatória.

#### O que não muda entre A e B

- **RNF02:** as duas desenham uma view nativa que ocupa o espaço que o layout der. Nenhuma tem
  atrito próprio em celular pequeno, grande ou tablet. O que garante o RNF02 é o nosso layout: altura
  do mapa proporcional à largura, sem px fixo, e padding do enquadramento vindo de `spacing`. Um
  cuidado nas duas: mapa dentro de `ScrollView` disputa o gesto de arrastar. Para um mapa só de
  conferência, a interação pode ficar desligada.
- **Offline:** nas duas, os tiles precisam de internet. Sem rede, a tela cai no estado de erro
  (mensagem em português e o resto do detalhe continua usável), como pede a task.
- **Development build novo:** as duas são módulos nativos. Precisa de novo `expo run:android` ou
  `eas build`, como nos ADRs 0003 e 0004.
- **Jest:** nas duas, o componente de mapa é mockado (critério de aceite).
- **DESIGN_CYAN:** nas duas, marcador e linha usam `colors.accent`/`colors.accentEdge`, sem cor nova.

### Pergunta 2 — Origem das coordenadas

#### C) Tabela de municípios do IBGE embarcada no app

Arquivo JSON com código IBGE, nome, UF, latitude e longitude dos 5.571 municípios. A fonte mais
prática é o dataset `kelvins/Municipios-Brasileiros` (licença MIT, derivado dos dados do IBGE). O
IBGE publica coordenadas oficiais no "Cadastro de Localidades Brasileiras Selecionadas", mas esse
arquivo cobre localidades e não serve direto.

**Prós**
- **Funciona offline e sem chamada externa.** Nenhuma chave, nenhum limite de requisição.
- **Não precisa de migration.** As coordenadas são calculadas na hora a partir de
  `cidade + UF`. Nada novo entra em `rota`, e o espelho Drizzle do ADR 0004 não muda.
- A busca é síncrona e local, o que facilita o teste (sem mock de rede).
- A comparação por nome pode repetir a regra de `normaliza_cidade()` em TypeScript (sem acento, sem
  maiúscula), a mesma do índice de duplicidade.

**Contras**
- **Cidade é texto livre.** Um erro de digitação ("Curitba") não acha a cidade, e o mapa cai no
  fallback "sem coordenadas". A correção de verdade seria o formulário da EIX-38 escolher a cidade
  de uma lista, mas isso é escopo da EIX-38 e decisão do Jean.
- **Peso no bundle (medido na implementação):** o `municipios.json` original do `kelvins` tem
  1,5 MB (9 colunas). Só com nome, latitude e longitude, agrupado por UF, ele cai para **190 KB**
  (73 KB com gzip). É esse formato compacto que vai no app.
- **Atualização:** município novo é raro, mas acontece. O dataset precisa ser trocado à mão quando
  o IBGE criar um. O último commit do `kelvins` é de dezembro de 2025, e o arquivo já tem os 5.571
  municípios, incluindo Boa Esperança do Norte (MT), instalado em 2025. Na prática, o custo é baixo:
  rodar o script que gera o arquivo compacto e os testes.
- Coordenada é a da sede do município. Para uma linha reta entre cidades, isso basta.

#### D) Serviço de geocodificação

**Prós**
- Acha qualquer endereço, não só a sede do município.
- Não pesa no bundle.

**Contras**
- **Exige internet** e, nos serviços com SLA (Google Geocoding, Mapbox, MapTiler), **chave e
  cobrança**. Aí volta todo o problema da chave da opção A, agora para um serviço pago por uso.
- O Nominatim (OSM, sem chave) limita a **1 requisição por segundo somando todos os usuários do
  app**, exige cache, proíbe autocomplete e desencoraja uso por apps distribuídos. Não serve para
  produção sem um proxy próprio.
- Para não geocodificar a cada abertura de tela, o resultado precisaria ser guardado. Isso quer
  dizer **latitude/longitude em `rota`**: migration no Postgres, espelho Drizzle e migration local
  no mesmo PR (ADR 0004). Quem faz isso é o Jean.
- Mais um estado de erro de rede para tratar e testar.

## Decisão

**B (MapLibre) + C (tabela do IBGE embarcada)**, a recomendação técnica abaixo, aceita pelo Diogo e
pelo Jean em 2026-10-18, depois da confirmação do professor.

- Pacote `@maplibre/maplibre-react-native` **11.5.0** (a `latest` em 2026-10-18; pede Expo ≥ 54,
  React Native ≥ 0.80 e React ≥ 19.1, e o projeto tem SDK 57, RN 0.86 e React 19.2).
- Tiles: estilo "positron" do OpenFreeMap (`https://tiles.openfreemap.org/styles/positron`), com a
  URL numa constante única em `src/features/rotas/mapa/`.
- Coordenadas: JSON compacto por UF em `src/features/rotas/mapa/`, gerado do `kelvins` por um script
  versionado junto, com a licença MIT do dataset ao lado. A busca compara a cidade com a mesma regra
  de `normaliza_cidade()` (`chaveCidade`, em `src/features/rotas/cidade.ts`).
- Nenhuma migration: `rota` continua sem latitude e longitude.

## Recomendação técnica (como foi proposta)

**Coordenadas: C (IBGE embarcado).** É a recomendação mais firme deste ADR. Ela não exige chave,
rede nem migration, e cobre o escopo da task (linha reta entre sedes de município). A geocodificação
só valeria se o escopo crescer para endereço exato, e esse não é o caso.

**Provedor: B (MapLibre), com ressalva.** A combinação MapLibre + IBGE deixa a feature **sem
nenhum segredo, sem conta de faturamento e sem SHA-1**, coerente com a regra de manter segredo fora
do código e com o histórico de atrito do login. O estilo cinza combina com o DESIGN_CYAN sem ajuste.
Para o tile, a sugestão é o OpenFreeMap, com a URL do estilo numa constante única, para trocar de
provedor sem mexer na tela, como a própria política do OSM recomenda.

**A ressalva:** se o Jean preferir a opção mais conhecida pela equipe (CLAUDE.md §1, "a solução mais
legível"), ou se a conta de faturamento do Google não for problema, o `react-native-maps` (A) é uma
escolha igualmente defensável. Ele tem mais exemplos e um tile com garantia do Google. O preço é
gerenciar a chave e os SHA-1. As duas opções atendem a todos os critérios de aceite.

## Dependências introduzidas

Instaladas só depois da confirmação do Jean (AGENTS.md §4).

| Pacote | Por quê |
|---|---|
| `@maplibre/maplibre-react-native` 11.5.0 (dependency) | Mapa, marcadores e linha. Config plugin do Expo em `app.config.ts` |
| `@types/geojson` (devDependency) | Peer dependency do MapLibre: tipos dos dados GeoJSON dos marcadores e da linha |

As coordenadas não trazem pacote: são um arquivo JSON em `src/features/rotas/mapa/`.

O MapLibre é módulo nativo. **O development build precisa ser gerado de novo**, como nos ADRs 0003
e 0004.

## Consequências

- Nenhuma variável nova no `.env`/`.env.example` e nenhum segredo no EAS.
- `app.config.ts` ganha o plugin do MapLibre. É um arquivo listado na task.
- O development build precisa ser gerado de novo.
- O app passa a depender de um servidor de tiles sem SLA. Se ele cair, o detalhe da rota mostra o
  estado de erro do mapa e o resto continua funcionando.
- Atribuição "© OpenStreetMap" visível no mapa (obrigatória).
- Rota com cidade digitada errado fica sem mapa até alguém corrigir o cadastro. Fica a sugestão
  para a EIX-38 (decisão do Jean): escolher a cidade de uma lista vinda do mesmo JSON.
- O JSON do IBGE precisa ser trocado quando surgir um município novo.

## Pontos que estavam em aberto

1. O professor confirmou o requisito (2026-10-18).
2. Provedor: B (MapLibre). Sem conta de faturamento nem chave no Google Cloud.
3. Cidade em texto livre ou lista: continua em aberto, fora do escopo da EIX-80. A EIX-38 entrou
   com texto livre.
4. Nenhuma migration: as coordenadas vêm do JSON, e `rota` não muda.

## Links

- Linear: EIX-80 (esta task), EIX-38 (US07, formulário e lista de Rotas)
- `supabase/migrations/20261014000200_rota_uf_ativa.sql` e `20261014000400_rota_trecho_sem_acento.sql`
- [`docs/adr/0004-offline-first.md`](./0004-offline-first.md) (espelho de `rota` no SQLite)
- Expo — react-native-maps (SDK 57): https://docs.expo.dev/versions/v57.0.0/sdk/map-view/
- react-native-maps: https://github.com/react-native-maps/react-native-maps
- Google — Maps SDK for Android, uso e cobrança: https://developers.google.com/maps/documentation/android-sdk/usage-and-billing
- MapLibre React Native — início e Expo: https://maplibre.org/maplibre-react-native/docs/setup/getting-started
  e https://maplibre.org/maplibre-react-native/docs/setup/expo
- Política de uso dos tiles do OSM: https://operations.osmfoundation.org/policies/tiles/
- Política de uso do Nominatim: https://operations.osmfoundation.org/policies/nominatim/
- OpenFreeMap: https://openfreemap.org
- Dataset de municípios: https://github.com/kelvins/Municipios-Brasileiros
- Segue o formato de [`docs/adr/0004-offline-first.md`](./0004-offline-first.md)
