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

## Handoff

- **Feature**: `.specs/features/eix27-schema-base`
- **Phase / Task**: Execute concluído (T1–T10) + Verifier PASS
- **Completed**: T1, T2, T3, T4, T5, T6, T7, T8, T9, T10
- **In-progress** (file:line): none
- **Next step**: push da branch e PR (revisor: Eduardo)
- **Blockers**: none
- **Uncommitted files**: none
- **Branch**: feat/eix-27-schema-base
