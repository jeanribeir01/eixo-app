# US15 — Login com Google Specification

**Linear:** EIX-13 (projeto "US15 — Login Google (Expo)")

## Problem Statement

O Eixo Certo foi reimplementado em React Native + Expo + Supabase e ainda não tem nenhuma tela.
Antes de construir qualquer módulo, a equipe precisa provar que o login com Google funciona de
ponta a ponta no Android (Google Sign-In nativo → Supabase Auth → sessão persistida). Sem isso,
nenhuma outra US que depende de usuário autenticado pode ser demonstrada.

## Goals

- [ ] Um usuário com conta Google entra no app pelo emulador Android e vê seus dados na Home.
- [ ] A sessão sobrevive ao fechamento do app e fica guardada só no armazenamento seguro do sistema.
- [ ] Qualquer dev da equipe consegue rodar o app no emulador seguindo apenas o README.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Tabelas `perfil`/`usuario`, vínculo com `auth.users` e perfil padrão Motorista | Decisão do usuário: só Supabase Auth nesta entrega; fica para US16–US18 (S2) |
| RLS policies | Não há tabela nesta entrega |
| Navegação por cargo (grupos `(gestor)`/`(motorista)`) | Depende de perfil (US17) |
| iOS | Exige conta Apple Developer + EAS; documentado como próximo passo |
| Login por e-mail/senha, cadastro, "esqueci a senha" | Autenticação é só Google SSO (US15) |
| Offline, SQLite, sincronização | Não há dado de domínio nesta entrega |
| Ícone oficial e tratamento visual próprio do botão Google | Issues separadas EIX-11 e EIX-12 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Backend | Projeto Supabase na nuvem, sem Docker | Docker/Supabase CLI não instalados; auth não precisa de schema local | y |
| Google Cloud | Reaproveitar projeto da EIX-5, adicionando client Android | Evita recriar tela de consentimento e client Web | y |
| Plataforma | Só Android | Teste possível no emulador local; iOS precisa de conta Apple | y |
| Package Android | `com.eixocerto.app` | Identificador estável exigido pelo client OAuth Android | y |
| Lib de Google Sign-In | `@react-native-google-signin/google-signin` (versão gratuita) | É a lib indicada pela doc do Supabase para Expo; entrega idToken para `signInWithIdToken` | y |
| Nonce | Não enviado; "Skip nonce check" documentado como necessário só para iOS | A versão gratuita da lib não suporta nonce customizado; doc do Supabase exige o skip apenas no iOS | y |
| Armazenamento da sessão | Adapter sobre `expo-secure-store` dividindo valores grandes em partes de até 1800 caracteres | SecureStore avisa acima de ~2048 bytes e a sessão do Supabase passa disso; AsyncStorage é proibido pelo CLAUDE.md | y |
| Grupos de rota | `(auth)` para Login e `(app)` para Home | `(app)` é provisório até existir perfil (US17) | y |
| Idioma das mensagens | Português do Brasil | Público do app e da banca | y |
| Mensagens de erro | Textos fixos definidos em AUTH-05..AUTH-07 | Critério observável e testável | y |
| Conteúdo da Home | Nome, e-mail, foto (ou inicial do nome) e botão "Sair" | Suficiente para provar que a sessão é real; usuário pediu Home simples | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Entrar com Google ⭐ MVP

**User Story**: As a usuário do Eixo Certo, I want entrar com minha conta Google so that eu acesse o app sem criar senha.

**Why P1**: É o objetivo inteiro desta entrega e pré-requisito de todas as outras US.

**Acceptance Criteria**:

1. WHEN o app é aberto sem sessão salva THEN the app SHALL exibir a tela de Login com o botão "Continuar com Google".  <!-- AUTH-01 -->
2. WHEN o usuário toca "Continuar com Google" e o Google retorna um idToken THEN the app SHALL chamar `supabase.auth.signInWithIdToken` com `provider: 'google'` e esse token, e exibir a Home ao receber a sessão.  <!-- AUTH-02 -->
3. WHILE a autenticação está em andamento the Login SHALL manter o botão desabilitado e exibir um indicador de carregamento.  <!-- AUTH-03 -->
4. IF o usuário cancela o seletor de contas do Google THEN the app SHALL permanecer no Login, sem mensagem de erro, com o botão habilitado.  <!-- AUTH-04 -->
5. IF o Google Play Services está indisponível THEN the app SHALL exibir "Google Play Services indisponível neste dispositivo." e reabilitar o botão.  <!-- AUTH-05 -->
6. IF o Google não retorna idToken THEN the app SHALL exibir "Não foi possível obter o token do Google. Tente novamente." e reabilitar o botão.  <!-- AUTH-06 -->
7. IF o Supabase rejeita o token ou ocorre qualquer outro erro THEN the app SHALL exibir "Não foi possível entrar. Tente novamente." e reabilitar o botão.  <!-- AUTH-07 -->

**Independent Test**: No emulador, abrir o app, tocar "Continuar com Google", escolher a conta e ver a Home; cancelar o seletor e continuar no Login sem erro.

---

### P1: Sessão persistente e segura ⭐ MVP

**User Story**: As a usuário autenticado, I want continuar logado ao reabrir o app so that eu não precise entrar toda vez.

**Why P1**: CLAUDE.md exige sessão persistente (US15) guardada em `expo-secure-store` (RNF04).

**Acceptance Criteria**:

1. WHEN o app é aberto com sessão salva válida THEN the app SHALL exibir a Home sem passar pela tela de Login.  <!-- AUTH-08 -->
2. WHILE a sessão salva ainda está sendo lida the app SHALL manter a splash screen visível e não renderizar Login nem Home.  <!-- AUTH-09 -->
3. The storage adapter SHALL gravar a sessão somente via `expo-secure-store`, dividindo valores maiores que 1800 caracteres em partes, e SHALL devolver exatamente o valor original na leitura.  <!-- AUTH-10 -->
4. WHEN o storage adapter remove uma chave THEN the adapter SHALL apagar todas as partes gravadas para ela, e a leitura seguinte SHALL retornar `null`.  <!-- AUTH-11 -->
5. IF `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` ou `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` estiver ausente ou inválida THEN the app SHALL lançar um erro cuja mensagem cita o nome da variável.  <!-- AUTH-12 -->

**Independent Test**: Entrar, fechar o app pelo gerenciador de tarefas, reabrir e cair direto na Home; testes unitários do adapter com valor de 5000 caracteres.

---

### P1: Home de teste com Sair ⭐ MVP

**User Story**: As a usuário autenticado, I want ver meus dados e poder sair so that eu confirme que o login funcionou e troque de conta.

**Why P1**: É a prova visível de que a autenticação funcionou (pedido explícito do usuário).

**Acceptance Criteria**:

1. The Home SHALL exibir o nome completo e o e-mail do usuário da sessão.  <!-- AUTH-13 -->
2. WHERE o usuário tem foto no Google the Home SHALL exibir a foto; caso contrário SHALL exibir a inicial maiúscula do nome.  <!-- AUTH-14 -->
3. WHEN o usuário toca "Sair" THEN the app SHALL chamar `supabase.auth.signOut` e `GoogleSignin.signOut` e exibir a tela de Login.  <!-- AUTH-15 -->

**Independent Test**: Na Home, conferir nome/e-mail/foto; tocar "Sair" e voltar ao Login; entrar de novo mostra o seletor de contas.

---

## Edge Cases

- IF o usuário toca "Continuar com Google" de novo enquanto uma tentativa está em andamento THEN the app SHALL ignorar o toque (coberto por AUTH-03: botão desabilitado).
- IF o nome do usuário vier vazio nos metadados THEN the Home SHALL exibir o e-mail no lugar do nome e usar a inicial do e-mail.
- IF `GoogleSignin.signOut` falhar durante "Sair" THEN the app SHALL ainda encerrar a sessão do Supabase e exibir o Login.
- WHEN o refresh automático do token falha e o Supabase emite `SIGNED_OUT` THEN the app SHALL exibir o Login.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Entrar com Google | T5 | Implementing |
| AUTH-02 | P1: Entrar com Google | T4 | Implementing |
| AUTH-03 | P1: Entrar com Google | T2, T6 | Implementing |
| AUTH-04 | P1: Entrar com Google | T4 | Implementing |
| AUTH-05 | P1: Entrar com Google | T4 | Implementing |
| AUTH-06 | P1: Entrar com Google | T4 | Implementing |
| AUTH-07 | P1: Entrar com Google | T4 | Implementing |
| AUTH-08 | P1: Sessão persistente e segura | T5 | Implementing |
| AUTH-09 | P1: Sessão persistente e segura | T5 | Implementing |
| AUTH-10 | P1: Sessão persistente e segura | T3 | Implementing |
| AUTH-11 | P1: Sessão persistente e segura | T3 | Implementing |
| AUTH-12 | P1: Sessão persistente e segura | T3 | Implementing |
| AUTH-13 | P1: Home de teste com Sair | Tasks | Pending |
| AUTH-14 | P1: Home de teste com Sair | Tasks | Pending |
| AUTH-15 | P1: Home de teste com Sair | T4 | Implementing |

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Login com Google concluído no emulador `pixel_7_-_api_36_0` e usuário listado em Supabase → Authentication → Users.
- [ ] Reabrir o app após fechá-lo leva direto à Home.
- [ ] `npm run typecheck`, `npm run lint` e `npm test` passam sem erros.
