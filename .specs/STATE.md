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
- **Decision**: Migrations testadas no Jest com `@electric-sql/pglite` e stubs mínimos de `auth`/`storage`; migrations aplicadas na nuvem com `npx supabase db push`; espelho Drizzle adiado para a US08.
- **Reason**: Sem Docker (AD-003) não há Postgres local; PGlite roda Postgres real em WASM.
- **Trade-off**: Stub não é o Supabase real; exceção à regra "migration local no mesmo PR" do CLAUDE.md até a US08.
- **Scope**: `supabase/tests`, README, EIX-27.
- **Date**: 2026-09-24
- **Status**: active

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

## Handoff

- **Feature**: `.specs/features/eix36-dividas`
- **Phase / Task**: Execute concluído + Verifier PASS (iteração 2)
- **Completed**: RPCs `criar_divida`/`excluir_divida` + soft delete (a907d8f), schema Zod (64adb89), tipos gerados (bb0c6ac), repositório (7b13638), fixes do Verifier: centavos inexatos, status no excluir, grants (6735364); migration aplicada na nuvem
- **In-progress** (file:line): none
- **Next step**: push da branch e PR (EIX-36, revisor Diogo); o Eduardo usa `dividaSchema`, `somaTotalCentavos` e `dividasRepository` na EIX-50 e adiciona o seletor de forma de pagamento
- **Blockers**: none
- **Uncommitted files**: none
- **Branch**: feat/eix-36-us04-dividas-rollback
