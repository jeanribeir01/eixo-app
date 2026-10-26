# ADR 0004 — Offline-first: SQLite com Drizzle, outbox e servidor como árbitro de conflito

- **Status:** Aceito
- **Data:** 2026-10-16
- **Atualizado em:** 2026-10-26 (implementação da EIX-41)
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
3. **Outbox como tabela `outbox`.** Colunas: `id`, `usuario_id`, `entidade`, `operacao`
   (`insert` ou `update`), `payload` (JSON em texto), `status` (`pendente` ou `revisao`),
   `tentativas`, `codigo_erro`, `ultimo_erro`, `proxima_tentativa_em` e `criado_em`. Toda escrita local grava o registro e a linha da outbox na mesma transação,
   para não existir dado sem fila ou fila sem dado. A idempotência vem do UUID v7 gerado no cliente
   com `expo-crypto` (`getRandomBytes`): a operação sobe como `upsert` por `id`, então reenviar a
   mesma linha não duplica nada. A outbox tem dono: só a conta logada drena a própria fila, e trocar
   de conta não apaga a fila de outra pessoa. Linhas sem dono, criadas antes da coluna
   `usuario_id`, são adotadas pela primeira conta que entrar depois da migration.
4. **Conflito: o servidor vence, mas o dado local não é descartado.** A regra normal é
   last-write-wins decidido pelo servidor. O Postgres rejeita alteração em viagem já fechada
   (triggers `VG001`–`VG007`, EIX-76); nesse caso, em erro de payload, em update que não encontra
   linha no servidor ou depois do limite de tentativas, a operação vai para uma **fila de revisão
   do gestor** (`viagem_revisao`). A revisão guarda o payload local e usa o mesmo UUID da outbox como
   chave de idempotência; reenviar não duplica. Só Admin e Gestor de Frota leem a fila inteira e
   decidem; o motorista só vê a própria revisão. A autoria e a data da decisão são gravadas por
   trigger a partir da sessão, nunca aceitas do cliente, e não existe policy de delete para a trilha.
   No aparelho, a viagem afetada ganha `em_revisao = true`, coluna local que não existe no Postgres.
5. **A conexão separa falha temporária de falha de negócio.** Erro de rede não gasta tentativa:
   grava `proxima_tentativa_em` com backoff e interrompe a drenagem para não repetir o mesmo timeout
   em todos os itens; o store também aplica backoff exponencial entre ciclos. Erro de negócio/RLS
   conhecido vai direto para revisão; erro desconhecido incrementa `tentativas` até o máximo e então
   vai para revisão. O pull e a drenagem são disparados ao abrir o app, ao voltar para o primeiro
   plano, ao recuperar conexão e depois de uma escrita local (com debounce).
6. **Escopo mínimo, com cache das opções da viagem.** `viagem` lê e escreve. `veiculo`, `rota` e
   `usuario_cache` são somente leitura, como cache local para o motorista escolher veículo, rota e
   motorista sem internet. `sync_meta` guarda o dono do cache e metadados da sincronização. As demais
   tabelas continuam online. O pull baixa usuários, veículos, rotas e viagens em páginas, nessa ordem
   de dependência, e não sobrescreve viagem que ainda tem operação pendente na outbox. Ao trocar de
   conta, o cache de viagens/catálogos da conta anterior é limpo, mas todas as outboxes são
   preservadas; no logout, as viagens pendentes da conta que saiu e os veículos/rotas que elas
   referenciam ficam até a próxima sessão. Uma resposta de sincronização que chega depois da troca é
   descartada pela geração da sessão antes de qualquer escrita local.
7. **Espelho com os mesmos nomes de coluna do Postgres.** Isso mantém o mapeamento 1:1 e deixa o
   teste de paridade simples. Tipos: `uuid`, enum e `timestamptz` viram `text` (ISO 8601 UTC);
   `numeric` vira `real`; `boolean` vira `integer` com `mode: 'boolean'`. Aviso: dinheiro não entra
   neste escopo. Se entrar, use inteiros em centavos, nunca `real`. **Regra nova:** migration de
   nuvem que muda `viagem`, `veiculo` ou `rota` exige, **no mesmo PR**, a mudança do schema Drizzle e
   a migration do `drizzle-kit`. Isso encerra a exceção do ADR 0002 e da AD-006.
   O espelho **não** replica `rota_trecho_unico` nem as checks de normalização de placa e de cidade,
   porque `veiculo` e `rota` são só leitura no app e o servidor valida a escrita. O teste de paridade
   ignora `em_revisao`, que é estado só do aparelho.
8. **Testes com SQLite real.** O Jest roda `better-sqlite3` em memória com
   `drizzle-orm/better-sqlite3`, aplicando as mesmas migrations do app. O helper fica em
   `src/db/testing.ts`. Um teste de paridade compara as colunas do schema Drizzle com
   `src/types/database.ts`, e quebra se Postgres e SQLite divergirem. A fila de revisão é testada no
   PGlite (`supabase/tests/viagem_revisao.test.ts`) quanto a RLS, trigger de autoria, idempotência e
   ausência de delete.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `expo-sqlite` (dependency) | Banco local no aparelho. Módulo nativo do Expo |
| `expo-network` (dependency) | Saber se há conexão para a EIX-41 disparar a sincronização |
| `drizzle-orm` (dependency) | Schema e queries tipadas sobre o SQLite, com o driver `expo-sqlite` |
| `expo-crypto` (dependency) | Bytes aleatórios criptograficamente seguros para o UUID v7 do cliente |
| `drizzle-kit` (devDependency) | Gera as migrations do schema local |
| `better-sqlite3` (devDependency) | SQLite real em memória para o Jest, no Node |
| `@types/better-sqlite3` (devDependency) | Tipos do `better-sqlite3`, por causa do `strict` |
| `babel-plugin-inline-import` (devDependency) | Permite o Metro importar os `.sql` gerados pelo drizzle-kit. Configurado em `babel.config.js` (plugin) e `metro.config.js` (`sql` em `sourceExts`) |
| `babel-preset-expo` (devDependency) | Preset oficial do Babel para Expo, referenciado em `babel.config.js` e no transform do projeto `supabase` do Jest. Só é usado em build e teste |

`expo-sqlite` e `expo-network` são módulos nativos. **O development build precisa ser gerado de
novo** (`eas build --profile development`), como já avisado no ADR 0003.

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
- Como o servidor vence, uma edição local pode ser sobrescrita. Por isso o conflito de hodômetro
  vai para revisão do gestor, e não some: o payload local fica no aparelho e na fila `viagem_revisao`.
- A fila de revisão é somente do servidor: resolver ou descartar ali encerra a pendência para o
  gestor e registra a decisão, mas não reescreve nem apaga a viagem no aparelho do motorista. Essa
  separação é intencional nesta entrega, para nunca perder o dado local.
- Trocar de conta limpa o cache de viagens/catálogos da conta anterior, mas não apaga a outbox de
  nenhuma conta. No logout, as viagens pendentes da conta que saiu e os veículos/rotas que elas
  referenciam ficam até a próxima sessão; sem essa separação, um logout acidental poderia destruir
  trabalho offline. Sincronizações antigas que terminam depois da troca são descartadas antes de
  escrever no cache.
- O UUID v7 é gerado com `expo-crypto`; por isso o development build precisa ser refeito também por
  causa desse módulo nativo.
- Fora do escopo desta entrega: sincronizar as demais tabelas do app e aplicar automaticamente no
  aparelho a decisão tomada pelo gestor na fila de revisão.

## Links

- Linear: EIX-78 (fundação) e EIX-41 (sincronização)
- [`docs/adr/0002-schema-base-rls-e-testes-pglite.md`](./0002-schema-base-rls-e-testes-pglite.md)
- `.specs/STATE.md` (AD-006 e AD-010)
- `.claude/CLAUDE.md` §7 (Offline-first e Validação de hodômetro)
- Segue o formato de [`docs/adr/0003-anexo-de-comprovante-imagem.md`](./0003-anexo-de-comprovante-imagem.md)
