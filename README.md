# Eixo Certo

App mobile de **gestão financeira e controle de frota** para empresas de logística — Projeto da
Disciplina x PIEX. Esta é a reimplementação em **React Native + Expo + Supabase**.

> Contexto completo, regras e arquitetura: [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
> Guia visual: [`.claude/docs/DESIGN-CYAN.md`](.claude/docs/DESIGN-CYAN.md).
> Specs por US: [`.specs/features/`](.specs/features/).

**Estado atual:** US15 — Login com Google (Android) e uma Home de teste.

| Camada | Tecnologia |
|---|---|
| App | Expo SDK 57, React Native, TypeScript strict, expo-router |
| Backend | Supabase (Auth com provider Google) |
| Login | `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken` |
| Sessão | `expo-secure-store` (nunca AsyncStorage) |
| Testes | Jest (`jest-expo`) + React Native Testing Library |

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Configurar o emulador Android](#2-configurar-o-emulador-android)
3. [Configurar o Supabase](#3-configurar-o-supabase)
4. [Configurar o Google Cloud](#4-configurar-o-google-cloud)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Rodar o app](#6-rodar-o-app)
7. [Testes, lint e typecheck](#7-testes-lint-e-typecheck)
8. [Problemas comuns](#8-problemas-comuns)
9. [Fluxo de trabalho: Git + Linear](#9-fluxo-de-trabalho-git--linear)

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Node.js | 20 LTS ou mais novo | `node --version` |
| JDK | 17 ou mais novo (recomendado: Temurin 21) | `java -version` |
| Android Studio | Atual (instala o Android SDK e o emulador) | — |
| Git | Qualquer recente | `git --version` |

> **Expo Go não funciona neste projeto.** O login com Google usa código nativo, então o app roda
> como *development build* (gerado pelo `npx expo run:android`). macOS não é necessário.

---

## 2. Configurar o emulador Android

### 2.1 Instalar o SDK

1. Instale o [Android Studio](https://developer.android.com/studio).
2. Abra **More Actions → SDK Manager** e marque:
   - **SDK Platforms:** Android 16 (API 36)
   - **SDK Tools:** Android SDK Build-Tools, Android SDK Platform-Tools, Android Emulator

### 2.2 Variáveis de ambiente do SDK

O `adb` e o `emulator` precisam estar no PATH.

**Windows (PowerShell)** — rode uma vez e **abra um terminal novo**:

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
$path = [Environment]::GetEnvironmentVariable('Path', 'User')
[Environment]::SetEnvironmentVariable('Path', "$path;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator", 'User')
```

**Linux (CachyOS/Arch, bash ou zsh)** — adicione ao `~/.bashrc` ou `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

No **fish**: `set -Ux ANDROID_HOME $HOME/Android/Sdk` e `fish_add_path $ANDROID_HOME/platform-tools $ANDROID_HOME/emulator`.

No Linux, habilite aceleração por KVM (`sudo pacman -S qemu-base` e adicione seu usuário ao grupo
`kvm`), senão o emulador fica muito lento.

Confira:

```bash
adb --version
emulator -list-avds
```

### 2.3 Criar o dispositivo virtual

1. Android Studio → **More Actions → Virtual Device Manager → Create Virtual Device**.
2. Escolha **Pixel 7**.
3. Na imagem do sistema, escolha **API 36** com o ícone da **Play Store** (*Google Play*).
   Imagens "Google APIs" sem Play Store **não** fazem login com Google.
4. Finalize e dê um nome (ex.: `pixel_7_-_api_36_0`).

### 2.4 Abrir o emulador

```bash
emulator -avd pixel_7_-_api_36_0
```

Ou pelo botão ▶ no Device Manager. Com o emulador aberto:

1. Abra a **Play Store** no emulador e entre com uma conta Google (a mesma que vai testar o app).
2. Confira que o `adb` enxerga o aparelho:

```bash
adb devices
# List of devices attached
# emulator-5554   device
```

---

## 3. Configurar o Supabase

> Feito **uma vez** pelo Tech Lead; os demais devs só recebem a URL e a anon key. Issue: EIX-14.

1. Crie um projeto em [supabase.com](https://supabase.com) (região **South America (São Paulo)**).
2. **Authentication → Sign In / Providers → Google**:
   - Ative **Enable Sign in with Google**.
   - **Client IDs:** o *Client ID* do client **Web** do Google Cloud (seção 4).
   - **Client Secret:** o *Client Secret* desse mesmo client Web.
   - **Skip nonce checks:** só é necessário para iOS; no Android pode ficar desligado.
   - Salve.
3. **Project Settings → API**: copie a **Project URL** e a chave **anon / public**.

> A chave **service_role** nunca vai para o app, para o `.env` ou para o Git.

---

## 4. Configurar o Google Cloud

> Reaproveita o projeto do Google Cloud já criado (EIX-5). Issue: EIX-15.

No [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services**:

### 4.1 Tela de consentimento (OAuth consent screen)

- Tipo **External**, em modo **Testing**.
- Em **Test users**, adicione o e-mail Google de **cada dev** que vai testar. Quem não está na
  lista recebe erro ao entrar.

### 4.2 Client Web

**Credentials → Create Credentials → OAuth client ID → Web application.** (Se já existir um da
EIX-5, reaproveite.) Guarde o **Client ID** e o **Client Secret**:

- vão no provider Google do Supabase (seção 3);
- o Client ID também vai no `.env` como `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

> Parece estranho usar o client **Web** num app Android, mas é assim que funciona: o client Web
> emite o `idToken` que o Supabase valida. O client Android só autoriza o app a pedir esse token.

### 4.3 Client Android

**Create Credentials → OAuth client ID → Android**:

- **Package name:** `com.eixocerto.app`
- **SHA-1:** a impressão digital do certificado de debug.

O certificado de debug vem do template do React Native e é **o mesmo para todos os devs**, então um
único client Android serve para a equipe inteira. O SHA-1 atual é:

```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

Para conferir na sua máquina (depois de rodar o app uma vez, que gera a pasta `android/`):

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

> Builds de release/EAS usam **outro** certificado e precisarão de outro client Android com o SHA-1
> correspondente.

---

## 5. Variáveis de ambiente

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

Preencha o `.env`:

| Variável | Onde pegar |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Cloud → Credentials → client **Web** → Client ID |

O `.env` está no `.gitignore`. Se faltar alguma variável, o app fecha na abertura com uma mensagem
dizendo qual é.

---

## 6. Rodar o app

Com o emulador aberto (seção 2.4):

```bash
npm install
npx expo run:android
```

A **primeira** execução demora (compila o projeto nativo com Gradle — 5 a 15 minutos). Ela gera a
pasta `android/`, instala o app no emulador e abre o Metro bundler.

Nas próximas vezes, se você **não** instalou nenhuma biblioteca nativa nova, basta:

```bash
npm start
```

e abrir o app **Eixo Certo** já instalado no emulador. Se instalar/remover uma biblioteca nativa
ou mudar o `app.config.ts`, rode `npx expo run:android` de novo.

### Testando o login

1. O app abre na tela **Entre para continuar**.
2. Toque **Continuar com Google** e escolha a conta.
3. A Home mostra **Login confirmado** com seu nome, e-mail e foto.
4. Feche o app (arraste para fora da lista de recentes) e abra de novo: deve ir direto para a Home.
5. Toque **Sair**: volta para o Login.
6. Confira o usuário em Supabase → **Authentication → Users**.

---

## 7. Testes, lint e typecheck

```bash
npm test            # Jest
npm run lint        # ESLint (config do Expo)
npm run typecheck   # TypeScript sem emitir arquivos
```

Todo PR precisa passar nos três.

---

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `DEVELOPER_ERROR` ao tocar no botão | SHA-1 ou package do client Android não batem, ou `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` não é o client **Web** | Revise a seção 4; mudanças no Google Cloud podem levar alguns minutos para valer |
| "Google Play Services indisponível neste dispositivo." | Emulador sem Play Store | Crie o AVD com imagem *Google Play* (seção 2.3) |
| "Não foi possível entrar. Tente novamente." | Supabase recusou o token | Confira se o provider Google está ativo e se o Client ID Web está em **Client IDs** no Supabase |
| App fecha na abertura citando `EXPO_PUBLIC_...` | `.env` ausente ou incompleto | Seção 5; depois reinicie com `npm start -- --clear` |
| `adb: command not found` / `emulator` não encontrado | SDK fora do PATH | Seção 2.2, e abra um terminal novo |
| `SDK location not found` no Gradle | `ANDROID_HOME` não definido | Seção 2.2 |
| Erro de acesso bloqueado na tela do Google | E-mail não está em *Test users* | Seção 4.1 |
| Mudou `.env` e nada aconteceu | Metro guardou o valor antigo em cache | `npm start -- --clear` |

---

## 9. Fluxo de trabalho: Git + Linear

As tarefas ficam no Linear (workspace **Eixo App**, time **EIX**). Cada US é uma issue-mãe com
sub-issues por task. A integração GitHub ↔ Linear liga commits e PRs às issues automaticamente.

### Branch

Uma branch por issue, com o nome gerado pelo Linear (na issue: **⌘/Ctrl + Shift + .** ou botão
*Copy git branch name*):

```bash
git checkout main && git pull
git checkout -b jeanribeiro1905/eix-13-us15-login-com-google-no-app-expo
```

A `main` é protegida por convenção: **nada de commit direto**, só via PR aprovado pelo Tech Lead.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) com o ID da issue no rodapé:

```
feat(auth): cria tela de Login com botão Continuar com Google

Botão fica em loading durante a autenticação e cada falha mostra a mensagem do spec.

Closes EIX-21
```

| Tipo | Quando |
|---|---|
| `feat` | Funcionalidade nova |
| `fix` | Correção de bug |
| `refactor` | Mudança de código sem mudar comportamento |
| `test` | Só testes |
| `docs` | Só documentação |
| `build` / `chore` | Dependências, configuração, manutenção |

- `Refs: EIX-NN` → só vincula o commit à issue.
- `Closes EIX-NN` → move a issue para **Done** quando o PR entra na `main`.
- Um commit por task, com os testes da task no mesmo commit.

### Pull Request

- Título no mesmo padrão do commit principal; na descrição, o que muda, a US e `Closes EIX-NN`.
- Print ou vídeo quando houver mudança de UI.
- Precisa passar em `npm test`, `npm run lint` e `npm run typecheck`.
- PR que cria tabela sem RLS, ou muda schema sem a migration local correspondente, não é aprovado.
