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

### AD-011
- **Decision**: O Gestor de Frota lê `forma_pagamento`, só as linhas com `ativa = true`, por uma policy própria (`forma_pagamento_select_gestor`). Continua sem gravar `forma_pagamento` e sem ler `movimentacao`, `divida` e `categoria`. Revê, só para `forma_pagamento`, a decisão da EIX-32 de bloquear o Gestor em todas as tabelas financeiras (RLS-06).
- **Reason**: O formulário da US06-b (EIX-39) exige Forma de Pagamento, e quem registra manutenção é o Gestor (`registrar_manutencao` aceita Admin e Gestor). Com a policy da EIX-27, o seletor do Gestor vinha vazio. Mostrar só as ativas é o que o seletor precisa; forma inativa a RPC já recusa com `22023`.
- **Trade-off**: O Gestor passa a ver os nomes das formas ativas (Pix, Boleto…), que não são dado financeiro sensível. A categoria "Manutenção" não precisou da mesma exceção, porque a RPC a acha sozinha como `security definer`.
- **Scope**: `supabase/migrations/20261018000100_forma_pagamento_select_gestor.sql`, `supabase/tests/rls_perfis.test.ts` (RLS-06, RLS-17), EIX-39.
- **Date**: 2026-10-18
- **Status**: superseded by AD-013

### AD-013
- **Decision**: O Gestor de Frota vê as formas de pagamento ativas só pela RPC `listar_formas_pagamento_ativas()` (`security definer`, devolve `id` e `nome`). A policy `forma_pagamento_select_gestor` da AD-011 sai por migration nova, e o Gestor volta a ver zero linhas de `forma_pagamento` direto na tabela (RLS-06 da EIX-32). Substitui a AD-011.
- **Reason**: A RPC era a opção combinada para a EIX-39 (opção b da spec) antes do PR #37. As duas soluções juntas na `main` quebravam o CI do PR #38: um teste exigia que o Gestor lesse a tabela, o outro que não lesse. A RPC expõe só o que o seletor precisa e mantém a regra "Gestor não tem área financeira" sem exceção na tabela.
- **Trade-off**: Depois do `db push` das migrations 20261018000200 e 20261018000300, o seletor do Gestor fica vazio até `listarFormasPagamentoAtivas` chamar a RPC (T9 da EIX-39). Por isso a T9 entra no mesmo PR, antes do merge. A nuvem guarda a policy criada e removida no histórico de migrations.
- **Scope**: `supabase/migrations/20261018000200_formas_pagamento_ativas.sql`, `supabase/migrations/20261018000300_remove_forma_pagamento_select_gestor.sql`, `supabase/tests/rls_perfis.test.ts` (RLS-06), `.specs/features/eix32-rls/spec.md` (RLS-06, RLS-17), EIX-39. Número 013 porque a AD-012 já está no PR da EIX-80.
- **Date**: 2026-10-18
- **Status**: active

## Handoff

### EIX-68 — Motion contido

- **Feature**: `.specs/features/eix58-design-app`, fase 12, T41–T42 / ANI-01
- **Phase / Task**: implementação concluída; revisão independente PASS; quatro cenários visuais do motion aprovados pelo usuário em 25/10/2026
- **Completed**: Skeleton com pulso 1 → 0,5 → 1 em 1000 ms (`2c8d4d8`); transições de célula/linha em 200 ms, sem entering/exiting (`d4a2a7b`); correção do snapshot de movimento do Reanimated ao alterar a preferência com o app aberto, testes e evidências na entrega atual
- **Validation**: typecheck e lint exit 0; 1069 testes app + 311 Supabase verdes; sensor independente 4/4 mutações detectadas; release dos componentes conferido em emulador Android API 36 de dois núcleos; build release do app completo passou. Evidências e APK locais em `C:/eix68-build/evidence/`; relatório em `validation.md`
- **In-progress**: nenhum código pendente
- **Next step**: abrir PR para revisão de Jean e usar Squash and merge após aprovação; os fluxos autenticados não fizeram parte do aceite visual do motion
- **Blockers**: nenhum bloqueio técnico; aceite visual dos quatro cenários de motion registrado em validation.md
- **Uncommitted files**: nenhum após o commit da entrega; artefatos de build/probe ficam fora do repositório
- **Branch**: `feat/eix-68-design-motion`; Linear não encerrado; sem push, merge ou alterações de dados de produção
