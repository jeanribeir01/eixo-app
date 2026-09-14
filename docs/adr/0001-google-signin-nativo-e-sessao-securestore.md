# ADR 0001 — Google Sign-In nativo com sessão do Supabase no SecureStore

- **Status:** Aceito
- **Data:** 2026-09-13
- **US:** US15 (Linear EIX-13)
- **Decisões relacionadas:** `.specs/STATE.md` AD-001, AD-002, AD-003

## Contexto

A US15 exige login com Google e sessão persistente. O CLAUDE.md define Supabase Auth como backend,
proíbe AsyncStorage para sessão (RNF04) e pede ADR para dependências relevantes. A entrega é só
Android, com Supabase na nuvem.

## Decisão

1. **Login:** `@react-native-google-signin/google-signin` (versão gratuita) obtém o `idToken` no
   seletor nativo de contas; o app troca esse token por sessão com
   `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
2. **Sessão:** o `supabase-js` persiste a sessão num adapter próprio sobre `expo-secure-store`
   (`src/supabase/secureStorage.ts`) que divide o valor em partes de até 1800 caracteres.
3. **Build:** o app roda como development build (`expo-dev-client`, `npx expo run:android`).
4. **Plugin do Google Sign-In fora do `app.config.ts`:** sem opções o plugin aplica a configuração do
   Firebase (exige `google-services.json`); com `iosUrlScheme` ele altera só o iOS. No Android sem
   Firebase, o autolinking basta. O plugin entra quando o iOS for adicionado.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `@supabase/supabase-js` | Cliente do Supabase (Auth agora; PostgREST nas próximas US) |
| `@react-native-google-signin/google-signin` | Seletor nativo de contas Google e `idToken` |
| `expo-secure-store` | Armazenamento criptografado (Keystore/Keychain) da sessão |
| `zustand` | Estado global da sessão (CLAUDE.md §2) |
| `zod` | Validação das variáveis de ambiente e do `user_metadata` |
| `expo-font`, `expo-asset`, `@expo-google-fonts/inter` | Fonte Inter do design system |
| `expo-splash-screen` | Mantém a splash enquanto a sessão salva é lida |
| `expo-system-ui` | Aplica `userInterfaceStyle: 'light'` no Android |
| `expo-dev-client` | Development build com menu de desenvolvimento (Expo Go não suporta login nativo) |
| `react-dom` (19.2.3) | Sem uso direto; fixa a versão do peer opcional do Expo para o npm resolver a árvore sem conflito |
| `@testing-library/react-native` 13.x + `react-test-renderer` | O `expo-router/testing-library` do SDK 57 ainda depende da API síncrona do RNTL 13 |

## Alternativas consideradas

- **`expo-auth-session` (OAuth pelo navegador):** funciona no Expo Go, mas abre o navegador e exige
  redirect URLs por ambiente. Rejeitada: pior experiência e mais configuração frágil.
- **OAuth do Supabase via `signInWithOAuth` + deep link:** mesmo problema do navegador e do redirect.
- **`LargeSecureStore` da doc do Supabase (AES no SecureStore + dados no AsyncStorage):** rejeitada
  porque o CLAUDE.md proíbe AsyncStorage para sessão, mesmo criptografada.
- **Versão paga da lib (Universal Sign In com nonce):** desnecessária para Android nesta fase.

## Consequências

- Cada máquina precisa gerar o build nativo uma vez; não há Expo Go.
- O client OAuth Android do Google Cloud depende de package + SHA-1. O keystore de debug do template
  é igual para toda a equipe; builds de release/EAS exigirão outro client.
- O adapter de partes é código nosso e tem testes (`src/supabase/__tests__/secureStorage.test.ts`).
- Ao adicionar iOS: incluir o plugin com `iosUrlScheme`, criar client iOS e ligar *Skip nonce checks*
  no Supabase.
