# EIX-73 · Development build no celular

## Problem Statement

Aberto no Expo Go, o app quebra na hora: o `import` de `@react-native-google-signin/google-signin` chama `TurboModuleRegistry.getEnforcing('RNGoogleSignin')`, que não existe no Expo Go, e todas as rotas falham com "missing the required default export". Não há `eas.json` nem instrução de instalação no celular, e o time tenta pelo Expo Go. A entrega final (30/11) exige o app testado em celulares Android reais.

## Goals

- [ ] O time instala um APK de desenvolvimento gerado no EAS e roda o app no celular, com login Google.
- [ ] Quem abrir no Expo Go vê uma mensagem em português dizendo o que fazer, em vez da tela vermelha.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Perfil de release e APK final | É a EIX-88 |
| Variáveis `EXPO_PUBLIC_*` no EAS | O dev client baixa o JS do Metro local, que lê o `.env` da máquina. O APK de release (EIX-88) é que precisa delas no EAS |
| iOS | O projeto só configura Android; builds iOS sairiam pelo EAS em outra task |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Chave de assinatura do APK | A que o EAS gera e guarda (credenciais remotas). O SHA-1 dela vai para um client OAuth Android novo | O EAS usa uma chave por app em todos os perfis: o mesmo SHA-1 serve ao APK de release da EIX-88. A chave de debug do template só existe em quem rodou `prebuild` | n |
| Como detectar o Expo Go | `isRunningInExpoGo()` do pacote `expo` | API oficial do SDK; não exige dependência nova | y |
| Como evitar o crash no import | `googleAuth.ts` carrega o módulo nativo com `require` dentro das funções, não no topo do arquivo | O crash acontece na avaliação do módulo, antes de qualquer componente renderizar; só um carregamento sob demanda deixa o layout mostrar a mensagem | y |
| Onde fica a mensagem | No `app/_layout.tsx`, com `Screen` + `EmptyState` (ícone `alerta`, sem ação), como o erro de migration | Arquivos da task; mesmo padrão visual do erro de banco local. "Tentar novamente" não resolve, então não há ação | y |
| Login no EAS, `eas init`, build e registro do SHA-1 | Ações do Jean (critério da task); o agente prepara arquivos e comandos | Exigem a conta Expo e o console do Google Cloud | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Aviso no Expo Go ⭐ MVP

**User Story**: As a dev do time, I want a clear message when I open the project in Expo Go so that I know I need the development app.

**Why P1**: Hoje o erro é uma tela vermelha que não diz o que fazer.

**Acceptance Criteria**:

1. WHEN o app abre no Expo Go THEN the system SHALL mostrar o título "Este app não abre no Expo Go" e uma descrição que manda instalar o app de desenvolvimento e cita a seção "Rodar no celular" do README.  <!-- DEV-01 -->
2. WHEN o app abre no Expo Go THEN the system SHALL esconder a splash e não chamar `configureGoogleSignIn`.  <!-- DEV-02 -->
3. The system SHALL importar `src/features/auth/googleAuth.ts` sem avaliar `@react-native-google-signin/google-signin`; o módulo nativo só carrega quando uma função de login é chamada.  <!-- DEV-03 -->
4. WHEN o app abre fora do Expo Go THEN the system SHALL seguir o fluxo atual (configurar o Google e montar as rotas).  <!-- DEV-04 -->

**Independent Test**: Com `isRunningInExpoGo` simulado como `true`, o layout raiz mostra a mensagem; com o módulo do Google simulado para lançar ao ser avaliado, importar `googleAuth` não lança.

---

### P1: Build de desenvolvimento e guia ⭐ MVP

**User Story**: As a dev do time, I want an EAS development APK and a guide so that I can run the app on my phone.

**Why P1**: Destrava o teste em celular real exigido na entrega final.

**Acceptance Criteria**:

1. The system SHALL ter `eas.json` com o perfil `development`: `developmentClient: true`, `distribution: "internal"` e `android.buildType: "apk"`.  <!-- DEV-05 -->
2. The system SHALL ter o `projectId` do EAS em `app.config.ts` (`extra.eas.projectId`), gerado pelo `eas init`.  <!-- DEV-06 -->
3. The README SHALL ter a seção "Rodar no celular": instalar o APK do EAS ou `npx expo run:android --device` pelo USB, abrir o app Eixo Certo (não o Expo Go) e conectar ao Metro na mesma rede Wi-Fi.  <!-- DEV-07 -->
4. The README SHALL avisar que o Expo Go não funciona e que todo PR que adiciona dependência nativa exige build novo, avisado na descrição do PR.  <!-- DEV-08 -->
5. WHEN o APK do EAS é instalado no celular THEN o login com Google SHALL funcionar (SHA-1 da chave do EAS registrado no client OAuth Android).  <!-- DEV-09 -->

**Independent Test**: `eas build --profile development --platform android` gera um APK instalável; no celular, o login com Google entra.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| DEV-01 | P1: Aviso no Expo Go | Execute | Pending |
| DEV-02 | P1: Aviso no Expo Go | Execute | Pending |
| DEV-03 | P1: Aviso no Expo Go | Execute | Pending |
| DEV-04 | P1: Aviso no Expo Go | Execute | Pending |
| DEV-05 | P1: Build e guia | Execute | Pending |
| DEV-06 | P1: Build e guia | Execute | Pending |
| DEV-07 | P1: Build e guia | Execute | Pending |
| DEV-08 | P1: Build e guia | Execute | Pending |
| DEV-09 | P1: Build e guia | Execute (manual, Jean) | Pending |

**Coverage:** 9 total, 9 mapped, 0 unmapped

---

## Success Criteria

- [ ] Um colega instala o APK pelo link do EAS e entra com Google no próprio celular.
- [ ] Ninguém mais vê a tela vermelha do Expo Go.
