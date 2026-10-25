# ADR 0004 — Offline-first: SQLite com Drizzle, outbox e servidor como árbitro de conflito

- **Status:** Aceito
- **Data:** 2026-10-16
- **US:** EIX-78 (fundação), EIX-41 (sincronização)
- **Decisões relacionadas:** `.specs/STATE.md` AD-006 (exceção do espelho Drizzle encerrada), AD-010; ADR 0002

## Contexto

O motorista trabalha em estrada, muitas vezes sem sinal (RNF01, RNF07). Abrir e fechar viagem com
hodômetro precisa funcionar offline e subir quando a conexão voltar. O `supabase-js` não tem camada
offline, então essa parte é responsabilidade do app. O ADR 0002 adiou o espelho Drizzle/SQLite para
esta entrega, como débito registrado. A EIX-78 paga o débito: cria a fundação local (banco, outbox,
testes). A EIX-41 usa essa fundação para sincronizar de fato. Este ADR fixa as escolhas que as duas
tasks compartilham.

## Decisão

1. **`expo-sqlite` + Drizzle ORM (`drizzle-orm/expo-sqlite`).** O SQLite local é a fonte de verdade
   da UI: a tela lê dele, nunca direto do Supabase (CLAUDE.md §7). As migrations são geradas pelo
   `drizzle-kit` e aplicadas na abertura do app, antes de qualquer tela ler o banco. Assim o aparelho
   nunca roda com um schema desatualizado.
2. **Conectividade com `expo-network`.** Ele vem do SDK do Expo, tem versão alinhada ao SDK 57 e dá
   menos atrito que o `@react-native-community/netinfo`. Este ADR decide só a biblioteca. O listener
   e o backoff são da EIX-41.
3. **Outbox como tabela `outbox`.** Colunas: `id`, `entidade`, `operacao` (`insert` ou `update`),
   `payload` (JSON em texto), `tentativas`, `criado_em`, `ultimo_erro`. Toda escrita local grava o
   registro e a linha da outbox na mesma transação, para não existir dado sem fila ou fila sem dado.
   A idempotência vem do UUID gerado no cliente: a operação sobe como `upsert` por `id`, então
   reenviar a mesma linha não duplica nada.
4. **Conflito: o servidor vence.** É last-write-wins decidido pelo servidor. A exceção é o hodômetro
   de viagem já fechada: o Postgres rejeita a mudança (triggers `VG001`–`VG007`, EIX-76) e a operação
   vai para revisão do gestor, em vez de ser descartada em silêncio. O código dessa resolução é da
   EIX-41.
5. **Escopo mínimo.** `viagem` lê e escreve. `veiculo` e `rota` são somente leitura, como cache
   local para o motorista escolher veículo e rota sem internet. As demais tabelas continuam online.
6. **Espelho com os mesmos nomes de coluna do Postgres.** Isso mantém o mapeamento 1:1 e deixa o
   teste de paridade simples. Tipos: `uuid`, enum e `timestamptz` viram `text` (ISO 8601 UTC);
   `numeric` vira `real`; `boolean` vira `integer` com `mode: 'boolean'`. Aviso: dinheiro não entra
   neste escopo. Se entrar, use inteiros em centavos, nunca `real`. **Regra nova:** migration de
   nuvem que muda `viagem`, `veiculo` ou `rota` exige, **no mesmo PR**, a mudança do schema Drizzle e
   a migration do `drizzle-kit`. Isso encerra a exceção do ADR 0002 e da AD-006.
   O espelho **não** replica `rota_trecho_unico` nem as checks de normalização de placa e de cidade,
   porque `veiculo` e `rota` são só leitura no app e o servidor valida a escrita.
7. **Testes com SQLite real.** O Jest roda `better-sqlite3` em memória com
   `drizzle-orm/better-sqlite3`, aplicando as mesmas migrations do app. O helper fica em
   `src/db/testing.ts`. Um teste de paridade compara as colunas do schema Drizzle com
   `src/types/database.ts`, e quebra se Postgres e SQLite divergirem.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `expo-sqlite` (dependency) | Banco local no aparelho. Módulo nativo do Expo |
| `expo-network` (dependency) | Saber se há conexão para a EIX-41 disparar a sincronização |
| `drizzle-orm` (dependency) | Schema e queries tipadas sobre o SQLite, com o driver `expo-sqlite` |
| `drizzle-kit` (devDependency) | Gera as migrations do schema local |
| `better-sqlite3` (devDependency) | SQLite real em memória para o Jest, no Node |
| `@types/better-sqlite3` (devDependency) | Tipos do `better-sqlite3`, por causa do `strict` |
| `babel-plugin-inline-import` (devDependency) | Permite o Metro importar os `.sql` gerados pelo drizzle-kit. Configurado em `babel.config.js` (plugin) e `metro.config.js` (`sql` em `sourceExts`) |
| `babel-preset-expo` (devDependency) | Preset oficial do Babel para Expo, referenciado em `babel.config.js` e no transform do projeto `supabase` do Jest. Só é usado em build e teste |
| `expo-crypto` (dependency, EIX-41) | Bytes aleatórios seguros para o UUID v7 do cliente (`src/lib/uuid.ts`). O Hermes não garante `crypto.getRandomValues`, e `Math.random` é previsível |

`expo-sqlite`, `expo-network` e `expo-crypto` são módulos nativos. **O development build precisa ser gerado de
novo** (`eas build --profile development`), como já avisado no ADR 0003.

## Como a EIX-41 aplicou a decisão

- **Ids:** UUID v7 gerado no aparelho (`src/lib/uuid.ts`). A abertura sobe como upsert que ignora
  id repetido (`on conflict (id) do nothing`): reenviar não duplica nem altera a viagem.
- **Ordem:** a outbox sai pela ordem de criação, e o fechamento de uma viagem só sobe depois da
  abertura dela. Se a abertura não passou, o fechamento espera.
- **Situação do item** (coluna `situacao` da outbox): `pendente` ainda vai subir; `falha` e
  `conflito` foram recusados e ficam na fila, visíveis no indicador, porque reenviar daria o
  mesmo erro. Os dois não ocupam o lote de envio.
- **Conflito (revisão do gestor):** disputa de hodômetro, ou seja, `VG004`, `VG005`, `VG007` e o
  fechamento de uma viagem que o servidor já encerrou com outro hodômetro. O servidor vence; a
  versão dele desce para o aparelho na sincronização seguinte.
- **Falha:** as demais regras (`VG001`–`VG003`, `VG006`, constraints, `42501`) e erro temporário
  que passou de 5 tentativas. Abertura recusada (falha ou conflito) vira `Cancelada` no aparelho,
  para liberar o veículo.
- **Sem rede não é erro:** não gasta tentativa. Erro temporário do servidor espera 30 s, 1 min,
  2 min, 4 min (backoff exponencial, coluna `proxima_tentativa_em`).
- **Quando sincroniza:** na abertura do app, quando a conexão volta, logo depois de abrir ou
  fechar viagem, ao abrir a lista de viagens e, com pendência, a cada 30 s. Sem sessão não
  sincroniza, para o RLS não recusar tudo como `42501`.
- **Descida:** depois de enviar, o app copia do servidor veículos, rotas e as viagens que o RLS
  deixa a pessoa ver, com o nome do motorista (tabela local `motorista`, só id e nome). Viagem com
  item pendente não é sobrescrita; viagem que o servidor não devolve mais e não tem item na fila
  sai do aparelho.

## Alternativas consideradas

- **WatermelonDB:** tem sincronização pronta, mas traz um modelo próprio de schema e de sync, que
  disputa com o Supabase e com a regra de conflito do hodômetro. Pesado demais para uma equipe
  iniciante. Rejeitada.
- **PowerSync:** resolve o sync de ponta a ponta, mas é um serviço externo a mais, com custo e
  configuração própria. Rejeitada.
- **MMKV ou AsyncStorage:** guardam chave-valor, sem consulta nem transação. AsyncStorage é proibido
  para dado sensível (CLAUDE.md). Rejeitadas.
- **Mock do `expo-sqlite` no Jest:** o teste passaria sem provar que o SQL e as migrations
  funcionam. Rejeitada em favor do `better-sqlite3` real.
- **`@react-native-community/netinfo`:** funciona bem, mas não é do SDK do Expo e exige cuidar da
  versão à parte. Rejeitada.

## Consequências

- O schema existe em duas definições (Postgres e Drizzle). O teste de paridade e a regra do mesmo PR
  existem para o time não esquecer uma delas.
- O banco do Jest é `better-sqlite3`, enquanto o app usa `expo-sqlite`. Os dois são SQLite, mas o
  driver muda. O teste não cobre diferenças do driver nativo.
- A chave estrangeira é ligada na abertura do banco (`PRAGMA foreign_keys = ON` em `client.ts`),
  porque o SQLite a deixa desligada por padrão. O helper de teste liga o mesmo pragma.
- Como o servidor vence, uma edição local pode ser sobrescrita. Por isso a exceção do hodômetro vai
  para revisão do gestor, e não some.
- Fora do escopo desta entrega, tudo da EIX-41: drenagem da outbox, listener de conexão, backoff,
  indicador de sincronização na UI e resolução de conflito em código.

## Links

- Linear: EIX-78 (fundação) e EIX-41 (sincronização)
- [`docs/adr/0002-schema-base-rls-e-testes-pglite.md`](./0002-schema-base-rls-e-testes-pglite.md)
- `.specs/STATE.md` (AD-006 e AD-010)
- `.claude/CLAUDE.md` §7 (Offline-first e Validação de hodômetro)
- Segue o formato de [`docs/adr/0003-anexo-de-comprovante-imagem.md`](./0003-anexo-de-comprovante-imagem.md)
