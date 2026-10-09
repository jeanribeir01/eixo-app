# Eixo Certo

App mobile de **gestão financeira e controle de frota** para empresas de logística — Projeto da
Disciplina x PIEX. Esta é a reimplementação em **React Native + Expo + Supabase**.

> Contexto completo, regras e arquitetura: [`.claude/CLAUDE.md`](.claude/CLAUDE.md) e [`AGENTS.md`](AGENTS.md).
> Guia visual: [`DESIGN_CYAN.md`](DESIGN_CYAN.md).
> Specs por US: [`.specs/features/`](.specs/features/). Decisões: [`docs/adr/`](docs/adr/) e [`.specs/STATE.md`](.specs/STATE.md).

**Estado atual (out/2026):** login com Google e perfis de acesso (US15–US18), módulo Financeiro
completo — categorias, formas de pagamento, movimentações com comprovante, dívidas com rollback e
saldo com projeção de caixa (US01–US05) — e cadastro de frota (US06). Viagens, rotas e dashboards
estão em construção.

| Camada | Tecnologia |
|---|---|
| App | Expo SDK 57, React Native, TypeScript strict, expo-router |
| Backend | Supabase: Postgres com RLS, RPCs em plpgsql, Auth com provider Google, Storage |
| Login | `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken` |
| Sessão | `expo-secure-store` (nunca AsyncStorage) |
| Estado e validação | Zustand, Zod |
| Testes | Jest (`jest-expo`) + React Native Testing Library; migrations testadas com PGlite |

---

## Sumário

0. [Arquitetura](#0-arquitetura)
1. [Pré-requisitos](#1-pré-requisitos)
2. [Configurar o emulador Android](#2-configurar-o-emulador-android)
3. [Configurar o Supabase](#3-configurar-o-supabase)
4. [Configurar o Google Cloud](#4-configurar-o-google-cloud)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Rodar o app](#6-rodar-o-app)
7. [Perfis de teste: Admin e Motorista](#7-perfis-de-teste-admin-e-motorista)
8. [Testes, lint e typecheck](#8-testes-lint-e-typecheck)
9. [Problemas comuns](#9-problemas-comuns)
10. [Fluxo de trabalho: Git + Linear](#10-fluxo-de-trabalho-git--linear)

---

## 0. Arquitetura

**Apresentação:** _link a definir (EIX-54)_ · **Vídeo demonstrativo:** _link a definir (EIX-55)_

O app fala **direto** com o Postgres do Supabase, sem API própria no meio. Por isso a segurança
mora no banco:

| Peça | Onde | Por quê |
|---|---|---|
| Autorização | **RLS** em todas as tabelas, deny-by-default, com a função `auth_perfil()` | É a única fronteira: o app esconde telas, o banco decide o acesso ([ADR 0002](docs/adr/0002-schema-base-rls-e-testes-pglite.md)) |
| Operações atômicas | **RPCs em plpgsql** (ex.: `criar_divida` cria a dívida e as N parcelas) | Cada chamada é uma transação: se uma parcela falha, nada é gravado |
| Regras de integridade | Constraints e triggers nas migrations | Valem até para quem chama a API por fora do app |
| Saldo e projeção | RPC `resumo_caixa` agregando no banco | O cliente não soma lançamentos (RNF06) |
| Comprovantes | Storage em bucket **privado**, lido por URL assinada | [ADR 0003](docs/adr/0003-anexo-de-comprovante-imagem.md) |
| Sessão | `expo-secure-store`, só a chave **anon** no app | A `service_role` nunca entra no app ([ADR 0001](docs/adr/0001-google-signin-nativo-e-sessao-securestore.md)) |

No app, as rotas ficam em `app/` (expo-router) e só renderizam telas de `src/features/<módulo>/`,
montadas com os primitivos de `src/ui/` (tokens do `DESIGN_CYAN.md`). O perfil do usuário define
quais abas existem: Admin e Financeiro abrem no **Financeiro**, Gestor de Frota na **Frota** e
Motorista em **Viagens**.

---

## 1. Pré-requisitos

| Ferramenta | Versão | Como conferir |
|---|---|---|
| Node.js | 20 LTS ou mais novo (o CI usa o 20) | `node --version` |
| JDK | 17 ou mais novo (recomendado: Temurin 21) | `java -version` |
| Android Studio | Atual (instala o Android SDK e o emulador) | — |
| Expo CLI | Vem no projeto (`expo` ~57): use `npx expo`, sem instalar nada global | `npx expo --version` |
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
3. Na imagem do sistema, escolha **API 36** (a do vídeo de demonstração) com o ícone da
   **Play Store** (*Google Play*).
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

Há dois caminhos:

- **Usar o projeto da equipe** (devs do time): peça ao Tech Lead a URL e a anon key, peça para
  incluir seu e-mail Google em *Test users* (seção 4.1) e pule para a [seção 5](#5-variáveis-de-ambiente).
- **Montar um projeto próprio** (para reproduzir do zero): siga esta seção e a seção 4.

1. Crie um projeto em [supabase.com](https://supabase.com) (região **South America (São Paulo)**).
2. **Authentication → Sign In / Providers → Google**:
   - Ative **Enable Sign in with Google**.
   - **Client IDs:** o *Client ID* do client **Web** do Google Cloud (seção 4).
   - **Client Secret:** o *Client Secret* desse mesmo client Web.
   - **Skip nonce checks:** só é necessário para iOS; no Android pode ficar desligado.
   - Salve.
3. **Project Settings → API**: copie a **Project URL** e a chave **anon / public**.

> A chave **service_role** nunca vai para o app, para o `.env` ou para o Git.

### 3.1 Banco de dados: migrations e tipos

O schema mora em `supabase/migrations/` (SQL) e é a única forma de mudar o banco. Não crie
tabela pelo painel. A CLI roda via `npx`, sem instalação global e sem Docker.

```bash
npx supabase login                               # uma vez por máquina, abre o navegador
npx supabase link --project-ref <PROJECT-REF>    # uma vez por clone
npx supabase migration list                      # compara local x nuvem
```

O `<PROJECT-REF>` é o trecho da Project URL antes de `.supabase.co`
(`https://<PROJECT-REF>.supabase.co`).

**Aplicar migrations:**

```bash
npx supabase db push
```

Num projeto novo, isso monta o banco inteiro e já cria os dados de partida: os 4 perfis, as
categorias padrão (Combustível, Pedágio, Manutenção, Salário, Financiamento, Frete), as formas de
pagamento (Boleto, Pix, TED, Cartão Corporativo) e o bucket privado de comprovantes. Não há outro
seed para rodar. Lançamentos, dívidas e veículos de exemplo você cria pelo próprio app.

> No projeto da equipe, `db push` altera o banco que todos usam: rode só depois do PR aprovado e
> combine com o Tech Lead.

**Regenerar os tipos** depois de qualquer migration aplicada. O arquivo nunca é editado à mão:

```bash
npx supabase gen types typescript --linked --schema public > src/types/database.ts
```

**Nova migration:** `npx supabase migration new <nome>` cria o arquivo em `supabase/migrations/`.
Toda tabela nova precisa de RLS e policy na mesma migration ou PR.

**Testar as migrations localmente:** `npm test -- supabase/tests` aplica todas as migrations num
Postgres em memória (PGlite) e testa constraints e RLS por perfil. Não toca na nuvem. Detalhes
no `docs/adr/0002-schema-base-rls-e-testes-pglite.md`.

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
| `EXPO_PUBLIC_LOGIN_EMAIL_HABILITADO` | Opcional. `true` mostra o login por e-mail e senha, para as contas de teste da [seção 7](#7-perfis-de-teste-admin-e-motorista). Vazio em produção |

Todas são públicas por design (o prefixo `EXPO_PUBLIC_` entra no app). A chave **service_role**
nunca entra aqui. O `.env` está no `.gitignore`. Se faltar alguma variável, o app fecha na abertura com uma mensagem
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

e abrir o app **Eixo Certo** já instalado no emulador.

**Quando recompilar o app nativo:**

| Mudou | Rode |
|---|---|
| Só código TypeScript/JS | Nada: o `npm start` recarrega |
| Entrou ou saiu uma biblioteca nativa (ex.: `datetimepicker`) | `npm install` e `npx expo run:android` |
| `app.config.ts` ou arquivos de `assets/` usados nele (ícone, splash, plugins, permissões) | `npx expo prebuild --platform android` e depois `npx expo run:android` |

O `npx expo run:android` só recompila a pasta `android/` que já existe: ele **não** reaplica o
`app.config.ts`. Sem o `prebuild`, o ícone, a splash e as permissões continuam os antigos. O
`prebuild` recria a pasta `android/` do zero, o que é seguro: ela é gerada e fica fora do Git, e o
certificado de debug continua o mesmo, então o login com Google não quebra.

### Testando o login

1. O app abre na tela **Entre para continuar**.
2. Toque **Continuar com Google** e escolha a conta.
3. Na primeira vez, a conta nasce como Motorista **aguardando liberação** e o app mostra a tela
   **Aguardando liberação**. Para liberar, siga a [seção 7](#7-perfis-de-teste-admin-e-motorista).
4. Liberada, a conta abre na aba do seu perfil (Admin: **Financeiro**).
5. Feche o app (arraste para fora da lista de recentes) e abra de novo: a sessão continua.
6. Em **Configurações**, o cartão mostra nome, e-mail e perfil; **Sair** volta para o Login.

---

## 7. Perfis de teste: Admin e Motorista

Toda conta nova entra como **Motorista** com status **Aguardando liberação**: ninguém ganha acesso
sem aprovação. O primeiro Admin é promovido por SQL; os demais, pelo próprio app.

**1. Criar as contas.** Escolha um jeito:

- **Google:** entre no app com cada conta (o e-mail precisa estar em *Test users*, seção 4.1).
- **E-mail e senha** (mais rápido para testar vários perfis): no Supabase, **Authentication →
  Users → Add user → Create new user**, marque *Auto Confirm User*, e ponha
  `EXPO_PUBLIC_LOGIN_EMAIL_HABILITADO=true` no `.env` (reinicie com `npm start -- --clear`).

**2. Promover o primeiro Admin** no **SQL Editor** do Supabase. O SQL Editor pode fazer isso; pelo
app, ninguém altera o próprio perfil.

```sql
update public.usuario
set perfil_id = (select id from public.perfil where nome = 'Admin'),
    status = 'Ativo'
where email = 'admin@exemplo.com';
```

**3. Liberar o Motorista pelo app:** entre como Admin → **Configurações → Usuários** → toque na
conta → **Aprovar**. A conta já nasce como Motorista; para testar outro perfil, escolha o perfil e
toque **Salvar perfil**.

**4. Conferir o RBAC:** o Admin vê todas as abas e abre no Financeiro; o Motorista abre em
**Viagens** e não vê nenhuma área financeira. O banco aplica a mesma regra pelo RLS, então nem uma
chamada direta à API devolve dado financeiro ao Motorista.

---

## 8. Testes, lint e typecheck

```bash
npm test                     # Jest: app + migrations (PGlite)
npm test -- supabase/tests   # só as migrations, RLS e RPCs
npm run lint                 # ESLint (config do Expo)
npm run typecheck            # TypeScript sem emitir arquivos
```

Todo PR precisa passar nos três; o CI do GitHub roda os três em cada PR.

---

## 9. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Não foi possível entrar. Tente novamente." | O app mostra essa mesma mensagem genérica tanto para `DEVELOPER_ERROR` do Google (SHA-1/package do client Android não batem, ou `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` não é o client **Web**) quanto para o Supabase recusando o token — **não dá pra saber qual é só olhando a tela** | Confira nesta ordem: (1) seção 4 — client Android com SHA-1 correto e client Web certo no `.env`; (2) Supabase → provider Google ativo e com o Client ID Web em **Client IDs**. Mudanças no Google Cloud podem levar alguns minutos para valer |
| "Google Play Services indisponível neste dispositivo." | Emulador sem Play Store | Crie o AVD com imagem *Google Play* (seção 2.3) |
| App fecha na abertura citando `EXPO_PUBLIC_...` | `.env` ausente ou incompleto | Seção 5; depois reinicie com `npm start -- --clear` |
| `adb: command not found` / `emulator` não encontrado | SDK fora do PATH | Seção 2.2, e abra um terminal novo |
| `SDK location not found` no Gradle | `ANDROID_HOME` não definido | Seção 2.2 |
| Erro de acesso bloqueado na tela do Google | E-mail não está em *Test users* | Seção 4.1 |
| Mudou `.env` e nada aconteceu | Metro guardou o valor antigo em cache | `npm start -- --clear` |
| Tela **Aguardando liberação** depois do login | Conta nova, ainda não aprovada | Seção 7 |
| App fecha ao abrir uma tela depois de um `git pull` | Entrou uma biblioteca nativa nova e o app instalado é o antigo | `npm install` e `npx expo run:android` de novo |
| Ícone ou splash continuam os antigos | A pasta `android/` é anterior à mudança no `app.config.ts` | `npx expo prebuild --platform android` e `npx expo run:android`. Se o launcher ainda mostrar o ícone antigo, é cache: `adb uninstall com.eixocerto.app` e rode de novo |
| `Error while reading cache, falling back to a full crawl` | Cache do Metro ilegível (comum depois do `prebuild`) | Só um aviso: o Metro refaz o cache. Se repetir sempre, `npx expo start --clear` |

---

## 10. Fluxo de trabalho: Git + Linear

As tarefas ficam no Linear (workspace **Eixo App**, time **EIX**). Cada US é uma issue-mãe com
sub-issues por task. A integração GitHub ↔ Linear liga commits e PRs às issues automaticamente.

### Branch

Uma branch por issue, com o nome escrito no rodapé da issue no Linear (campo **Branch**):

```bash
git checkout main && git pull origin main
git checkout -b feat/eix-64-design-conta-usuarios
```

A `main` é protegida por um ruleset do GitHub: **nada de commit direto** nem `push --force`; tudo
entra por PR com **1 aprovação** de outro dev e merge por **Squash and merge**.

Para instalar dependência, use o npm 10, o mesmo do CI: `npx -y npm@10 install <pacote>`. O npm 11
reescreve o `package-lock.json` de um jeito que quebra o `npm ci` do CI.

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
