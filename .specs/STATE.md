# STATE

## Decisions

### AD-001
- **Decision**: Google SSO usa `@react-native-google-signin/google-signin` nativo + `supabase.auth.signInWithIdToken`, em development build (sem Expo Go).
- **Reason**: Fluxo indicado pela doc do Supabase para Expo; experiência nativa do seletor de contas; idToken validado pelo Supabase sem backend próprio.
- **Trade-off**: Não roda no Expo Go; cada dev precisa gerar o build e registrar o SHA-1 no Google Cloud; versão gratuita da lib não envia nonce.
- **Scope**: `src/features/auth`, configuração nativa, README.
- **Date**: 2026-09-13
- **Status**: active

### AD-002
- **Decision**: A sessão do Supabase é persistida só em `expo-secure-store`, através de um adapter que divide valores grandes em partes.
- **Reason**: CLAUDE.md proíbe AsyncStorage para sessão (RNF04) e o SecureStore limita ~2048 bytes por valor.
- **Trade-off**: Código próprio de chunking a manter e testar; leitura faz N acessos ao Keystore.
- **Scope**: `src/supabase`, qualquer dado sensível futuro.
- **Date**: 2026-09-13
- **Status**: active

### AD-003
- **Decision**: Nesta fase o app é só Android e o backend é um projeto Supabase na nuvem, sem stack local em Docker.
- **Reason**: Docker e Supabase CLI não estão instalados; a US15 não tem schema; iOS exige conta Apple.
- **Trade-off**: Devs compartilham o mesmo projeto de nuvem; migrations locais e iOS ficam para depois.
- **Scope**: README, `.env.example`, próximas sprints.
- **Date**: 2026-09-13
- **Status**: active

### AD-004
- **Decision**: Schema do Postgres em snake_case; toda tabela tem `data_inclusao` e `data_atualizacao` (trigger); enums nativos do Postgres; dinheiro em `numeric(12,2)`.
- **Reason**: A EIX-27 nomeia as colunas em snake_case; camelCase no Postgres exige aspas em todo SQL.
- **Trade-off**: Diverge dos nomes camelCase do CLAUDE.md seção 5; o mapeamento é 1:1 (`viagemId` → `viagem_id`).
- **Scope**: `supabase/migrations`, `src/types/database.ts`, todas as US.
- **Date**: 2026-09-24
- **Status**: active

### AD-005
- **Decision**: Autorização por `auth_perfil()` (`security definer`, lê `usuario` + `perfil`) em vez de custom claim no JWT; primeiro login cria `usuario` como Motorista por trigger em `auth.users`.
- **Reason**: Não exige Auth Hook e a troca de perfil vale na hora.
- **Trade-off**: Um select extra por policy avaliada.
- **Scope**: Todas as policies de RLS e Storage.
- **Date**: 2026-09-24
- **Status**: active

### AD-006
- **Decision**: Migrations testadas no Jest com `@electric-sql/pglite` e stubs mínimos de `auth`/`storage`; migrations aplicadas na nuvem com `npx supabase db push`. (O item "espelho Drizzle adiado para a US08" foi ENCERRADO na EIX-78: ver AD-010.)
- **Reason**: Sem Docker (AD-003) não há Postgres local; PGlite roda Postgres real em WASM.
- **Trade-off**: Stub não é o Supabase real. A exceção à regra "migration local no mesmo PR" do CLAUDE.md foi encerrada em 2026-10-16 para `viagem`, `veiculo` e `rota` (AD-010).
- **Scope**: `supabase/tests`, README, EIX-27.
- **Date**: 2026-09-24
- **Status**: active (exceção do espelho Drizzle encerrada em 2026-10-16 pela AD-010)

### AD-007
- **Decision**: O fuso `America/Sao_Paulo` do "mês atual" da `resumo_caixa()` sem `referencia` fica sem teste discriminante; os testes passam `referencia` explícita.
- **Reason**: São Paulo e UTC só divergem entre 21h e 24h do último dia do mês, e o `now()` do banco não é controlável no PGlite. Extrair um helper exigiria nova migration só para teste, com a RPC já aplicada na nuvem.
- **Trade-off**: O comportamento perto da meia-noite não é testado; um teste estrutural (`pg_get_functiondef` contém `America/Sao_Paulo`) barra a troca do fuso, mas não um erro de lógica em volta dele.
- **Scope**: `supabase/migrations/20261005000100_resumo_caixa.sql`, EIX-35.
- **Date**: 2026-10-05
- **Status**: active

### AD-008
- **Decision**: A transação da US04 (dívida + N parcelas) é uma RPC plpgsql `criar_divida`, não uma Edge Function com `postgres.js`. `divida` só é escrita por RPCs `security definer` (`criar_divida`, `excluir_divida`) com checagem de perfil; exclusão é soft delete (`divida.ativa`).
- **Reason**: Decidido com o usuário: a EIX-36 e a EIX-50 já nomeiam a RPC; uma chamada de RPC é uma transação no PostgREST (rollback automático); roda no harness PGlite (AD-006); sem cold start; não existe nenhuma Edge Function no repo nem o exemplo `docs/exemplos/us04-divida`.
- **Trade-off**: Diverge do `.claude/CLAUDE.md` §3 (Edge Function para operação atômica); a validação Zod não é compartilhada com o banco — as regras ficam duplicadas no schema do app e nas checks/RPC.
- **Scope**: `supabase/migrations/20261005000200_divida.sql`, `src/features/dividas`, EIX-36, EIX-50; serve de molde para a US06-b (`registrar_manutencao`).
- **Date**: 2026-10-05
- **Status**: active

### AD-009
- **Decision**: Em cor, tipografia, espaçamento, borda e forma, o `DESIGN_CYAN.md` vence as skills `expo-*` instaladas na EIX-59 (`expo-router`, `expo-native-ui`, `expo-design-system`, `expo-animation`) e a `vercel-react-native-skills`. As skills mandam em navegação, comportamento nativo, motion, acessibilidade e performance.
- **Reason**: As skills da Expo pedem cores semânticas do iOS, fonte do sistema, `@expo/ui` e evitam bordas de 1px; o guia do projeto escolhe Inter, paleta stone + um cyan e a hairline como estrutura. AGENTS.md §0 faz do guia a fonte única de verdade visual.
- **Trade-off**: Algumas "native slop tells" da skill (#6 Inter Everywhere, #9 Wireframe Borders, #18 Dark-Mode Amnesia) ficam aceitas de propósito; a auditoria da EIX-72 não as conta como defeito.
- **Scope**: Todas as telas e primitivos; EIX-58 e sub-tasks.
- **Date**: 2026-10-06
- **Status**: active

### AD-010
- **Decision**: Offline-first com `expo-sqlite` + Drizzle ORM (SQLite é a fonte da UI), conectividade por `expo-network` e outbox em tabela (`id`, `entidade`, `operacao`, `payload`, `tentativas`, `criado_em`, `ultimo_erro`) com upsert idempotente por UUID do cliente. Conflito: o servidor vence, exceto hodômetro de viagem fechada (triggers VG001-VG007), que vai para revisão do gestor. Escopo mínimo: `viagem` lê/escreve; `veiculo` e `rota` só leitura. Espelho Drizzle com os mesmos nomes de coluna do Postgres; migration de nuvem que muda `viagem`/`veiculo`/`rota` exige schema Drizzle + migration drizzle no mesmo PR. Jest usa `better-sqlite3` em memória com as mesmas migrations (`src/db/testing.ts`) e teste de paridade com `src/types/database.ts`.
- **Reason**: Motorista opera sem internet (RNF01, RNF07); o `supabase-js` não tem camada offline. SQLite real no Jest prova o SQL e as migrations, o que um mock não prova. `expo-network` é do SDK do Expo, com versão alinhada ao SDK 57.
- **Trade-off**: Duas definições de schema a manter em sincronia; o driver do Jest (`better-sqlite3`) difere do app (`expo-sqlite`); `expo-sqlite` e `expo-network` são nativos e exigem novo development build; edição local pode ser sobrescrita pelo servidor.
- **Scope**: `src/db`, `src/db/migrations`, `drizzle.config.ts`, `package.json`, EIX-78 (fundação) e EIX-41 (drenagem, listener, backoff, indicador na UI e resolução de conflito). Detalhes em `docs/adr/0004-offline-first.md`.
- **Date**: 2026-10-16
- **Status**: active

## Handoff

- **Feature**: `.specs/features/eix79-ano-inativar` (EIX-79)
- **Phase / Task**: T1..T6 concluídas; entrega por commit, push e PR autorizada explicitamente em 18/10/2026
- **Completed**: ano obrigatório, null legado, tradução 23514, inativação condicional, preservação de Inativo e selecionáveis. Typecheck/lint verdes; nova execução de 900 testes app e 300 backend aprovada. Verifier independente e sensor 6/6 preservados de 16/10. Supabase isolado com Auth/RLS reais, quatro perfis e concorrência validados; APK instalado no Pixel 7 e smoke UI Admin executado (cadastro, edição, limites 1949/1950/2027, teclado/scroll, confirmação/cancelamento, Snackbar, filtros e persistência)
- **In-progress** (file:line): `.specs/features/eix79-ano-inativar/validation.md` — evidências finais registradas; preparação da entrega
- **Next step**: revisão de Jean no PR para main; aceite humano, tablet/TalkBack e observação visual do loading continuam pendentes, conforme relatório
- **Blockers**: nenhum bloqueio de implementação; testes de dispositivo físico e aceite humano não executados
- **Uncommitted files**: somente feature veiculos, testes RLS e artefatos desta especificação; arquivos locais de sandbox/build/env ignorados
- **Branch**: feat/eix-79-us06-ano-inativar; base eff0160; Linear inalterado. Supabase local e build nativo em diretórios separados, fora do repositório; login local pela flag que já existe no `.env.local`, sem desvio no código
