# CLAUDE.md — Eixo Certo (React Native + Expo + Supabase)

Este arquivo é a fonte de verdade de contexto para agentes de IA e para a equipe neste
repositório. Leia-o por inteiro antes de gerar qualquer código.

---

## 1. O que é o Eixo Certo

Aplicativo mobile de **gestão financeira e controle de frota** para empresas do ramo
logístico. O gestor precisa enxergar a saúde financeira do negócio em tempo real — do
fluxo de caixa diário ao desgaste e custo por quilômetro de cada veículo — enquanto o
motorista opera com **autonomia total em campo, mesmo sem internet**.

**Contexto acadêmico:** Projeto da Disciplina x PIEX. Equipe de 5 desenvolvedores de
perfil iniciante, trabalhando com IA orientada por prompts estruturados e fluxo
spec-driven. Há um Tech Lead responsável por arquitetura base, code review, governança de
branches e DevOps.

**Regra de ouro do projeto:** a equipe é iniciante. Prefira sempre a solução mais legível
e explícita à mais elegante. Código que o time não consegue explicar na banca é código
que não deveria existir.

---

## 2. Stack

Este repositório é uma **reimplementação em React Native + Expo** de um projeto
originalmente especificado em .NET MAUI. A documentação de domínio, os requisitos e as
user stories permanecem válidos; apenas a camada de implementação mudou.

| Camada | Escolha | Observação |
|---|---|---|
| Runtime | **Expo (SDK estável mais recente)** | Managed workflow + **development build** — Expo Go não suporta Google Sign-In nativo |
| Linguagem | **TypeScript strict** | `strict: true` obrigatório, sem `any` implícito |
| Navegação | **expo-router** | Rotas por arquivo, com grupos por perfil de acesso |
| UI | **Componentes próprios** sobre os tokens do design system | Sem biblioteca de UI opinativa — ver seção 7 |
| Estilo | **StyleSheet** (ou NativeWind, se o time preferir) | Tokens centralizados, nunca hex solto |
| Backend | **Supabase** | Postgres + Auth + Storage + Edge Functions |
| Estado servidor | **TanStack Query** | Cache, revalidação, estados de carregamento |
| Estado local | **Zustand** | Sessão, perfil ativo, preferências |
| Banco local | **expo-sqlite** + **Drizzle ORM** | Offline-first (RNF01, RNF07) |
| Validação | **Zod** | Schemas compartilhados entre formulário e resposta do Supabase |
| Formulários | **react-hook-form** + resolver Zod | |
| Gráficos | **react-native-gifted-charts** ou **victory-native** | US12, US13 |
| Arquivos | `expo-image-picker`, `expo-file-system`, `expo-print`, `expo-sharing` | Comprovantes (US03) e exportação CSV/PDF (US14) |
| Sessão segura | **expo-secure-store** | Adapter de storage do `supabase-js` — nunca `AsyncStorage` |
| Build/deploy | **EAS Build** + EAS Update | Android e iOS |

### Ambiente

Desenvolvimento compatível com **Linux** (CachyOS) e **Windows**. Nenhuma etapa do fluxo
pode exigir macOS — builds de iOS saem via EAS.

---

## 3. Supabase — a arquitetura de backend

Não existe API intermediária. **O app fala direto com o Postgres via PostgREST.** Isso tem
uma consequência central que atravessa todo o projeto:

> **O RLS não é uma camada extra de segurança. Ele é a única fronteira de autorização.**
> Se uma policy estiver errada, o dado está exposto — não há servidor próprio para segurar.

### Divisão de responsabilidades

| Necessidade | Onde mora |
|---|---|
| CRUD simples (categorias, formas de pagamento, veículos, rotas) | Tabelas + RLS, acesso direto via `supabase-js` |
| Autorização por perfil (US18) | **RLS policies**, deny-by-default em todas as tabelas |
| Operações atômicas (rollback de parcelas — US04) | **Edge Function em TS** com transação via `postgres.js` |
| Invariantes de dados (hodômetro não regride, valor não negativo) | **Constraints e triggers SQL** — a única camada que ninguém contorna |
| Regra de negócio do hodômetro (US08) | **Edge Function em TS**, apoiada na constraint acima |
| Motor de saldo e previsão (US05) | **View** SQL agregando no banco |
| Estatísticas de rota e custo por KM (US10) | **View** SQL, materializada se necessário |
| Dashboards e KPIs (US11–13) | **Views** — agregação no servidor, nunca no cliente (RNF06) |
| Autenticação Google SSO (US15) | **Supabase Auth** com provider Google |
| Comprovantes (US03) | **Supabase Storage**, bucket privado com policies |
| Lógica que precisa de segredo ou serviço externo | **Edge Function** (Deno/TypeScript) |

### Regras de segurança não negociáveis (RNF04, US18)

- **RLS habilitado em todas as tabelas, sem exceção.** Tabela nova sem policy é bug de segurança.
- **Deny-by-default.** Escreva as policies como permissões explícitas, nunca como exceções a um acesso aberto.
- A chave **`anon`** vai no app e é pública por design — isso é seguro **apenas** porque o RLS protege.
- A chave **`service_role` nunca entra no bundle do app.** Só em Edge Functions e CI, via secret.
- Variáveis públicas com prefixo `EXPO_PUBLIC_`; qualquer coisa sensível fica fora do cliente.
- Comprovantes em bucket **privado**, servidos por signed URL com expiração curta.

### Perfil do usuário e RLS

A tabela `usuario` liga `auth.users` (do Supabase) ao `perfil` do domínio, via
`googleSubjectId`/`auth.uid()`. As policies consultam esse vínculo para decidir acesso.

Padrão recomendado: uma function `auth_perfil()` que devolve o perfil do usuário logado,
usada dentro das policies. Alternativa mais performática: custom claim no JWT populada por
um Auth Hook. **Documente qual das duas foi escolhida em `docs/adr/`.**

Exemplo do espírito das policies:

- `movimentacao`: leitura para `Admin` e `Financeiro`. **Motorista não lê nada.**
- `viagem`: motorista lê e escreve **apenas as próprias viagens** (`motoristaId = auth_usuario_id()`).
- `veiculo`, `rota`: leitura para todos os perfis autenticados; escrita para `Admin` e `Gestor de Frota`.
- `usuario`, `perfil`: escrita apenas para `Admin` (US16).

### Migrations

Fonte de verdade do schema em nuvem: **`supabase/migrations/`**, versionado no repo e
aplicado via Supabase CLI. O schema local do SQLite (Drizzle) **espelha** esse schema.

> Risco conhecido: duas definições de schema (Postgres e SQLite) podem divergir. Toda
> migration de nuvem exige a migration local correspondente **no mesmo PR**. Sem exceção.

### Paridade de tipos ponta a ponta — TypeScript dos dois lados

A justificativa original do .NET MAUI era compartilhar modelos de domínio entre front e
back. **Esta stack recupera isso**, e com validação de tipo mais forte do que o projeto
original tinha. Esse é um argumento de defesa da troca de stack, não só uma explicação.

Três camadas de tipo, cada uma com uma origem única:

| Camada | Origem | Quem consome |
|---|---|---|
| **Tipos de tabela** | Gerados de `supabase gen types` → `src/supabase/types.ts` | App e Edge Functions |
| **Schemas de domínio** | Escritos à mão em `packages/domain/` com Zod | App (formulário) e Edge Function (payload) |
| **Contratos de Edge Function** | `z.infer` dos schemas de domínio | App e Edge Function |

O ganho concreto: adicionar um campo obrigatório ao schema de domínio quebra a compilação
no formulário **e** na Edge Function no mesmo `npm run typecheck`. Nenhum dos dois lados
pode divergir em silêncio.

#### O que NÃO migra para TypeScript

Seja honesto sobre o limite — a banca pode perguntar:

- **Migrations continuam em SQL** (`supabase/migrations/`). Não existe atalho.
- **Invariantes continuam em constraint/trigger.** Regra que protege integridade mora no
  banco, porque é a única camada que vale mesmo quando alguém chama a API por fora.
- **Agregação de dashboard continua em view.** Fazer isso em TS quebraria o RNF06.

Edge Function é para **orquestrar lógica de negócio**, não para substituir o banco.

#### Por que Edge Function e não `rpc()` + plpgsql

`supabase-js` **não faz transação multi-statement**. Para a US04 — criar uma dívida e suas
N parcelas de forma atômica — existem exatamente duas saídas: uma Postgres function em
`plpgsql`, ou uma Edge Function abrindo conexão direta ao Postgres. Escolhemos a segunda
para manter a paridade de linguagem e reaproveitar os schemas Zod.

Armadilhas dessa escolha, todas já resolvidas no exemplo de referência:

- Conexão via **Supavisor em transaction mode** exige `prepare: false` no `postgres.js`.
  Sem isso, falha com erro de prepared statement.
- **Feche a conexão** ao fim de cada invocação (`await sql.end()`), ou o pool vaza entre
  cold starts.
- **Cold start** de Edge Function custa algumas centenas de ms. Irrelevante para escrita
  pontual, inaceitável para listagem — por isso leitura continua indo direto via PostgREST.
- Edge Function valida JWT por padrão, mas **verificar o perfil é trabalho seu**: pegue o
  usuário do token e confira o perfil antes de escrever.

#### Referência

`docs/exemplos/us04-divida/` contém a implementação completa do padrão: schema de domínio,
Edge Function com transação e rollback, e o client tipado no app. **Use como molde** para
qualquer outra operação atômica.

### Limite importante do Supabase

`supabase-js` **não tem camada offline**. A arquitetura offline-first da seção 6 continua
sendo inteiramente responsabilidade deste repositório. Supabase é o destino da
sincronização, não a solução dela.

---

## 4. Requisitos Não Funcionais (ISO/IEC 25010)

Todo PR deve poder responder: "qual RNF este código respeita ou arrisca?"

| ID | Requisito | Característica ISO | Como se materializa aqui |
|---|---|---|---|
| **RNF01** | Arquitetura **Offline-First** nas rotinas do motorista: salvar local sem internet e sincronizar ao reconectar | Confiabilidade | SQLite + fila de sincronização (outbox) |
| **RNF02** | Interface responsiva em smartphones e tablets | Usabilidade | `useWindowDimensions`, breakpoints, sem largura fixa |
| **RNF03** | Guia de estilos consolidado obrigatório | Usabilidade (estética) | **`DESIGN-CYAN.md` é o guia adotado** — ver seção 7 |
| **RNF04** | Criptografia de dados financeiros e de autenticação em trânsito e em repouso | Segurança | TLS do Supabase; sessão em `expo-secure-store`; RLS |
| **RNF05** | Portabilidade nativa/híbrida em Android e iOS | Portabilidade | Expo cross-platform; nada exclusivo de plataforma sem fallback |
| **RNF06** | Dashboards e BI respondem em **menos de 2s** | Desempenho | Views agregadas no Postgres, índices, paginação |
| **RNF07** | Integridade transacional de hodômetros e viagens até confirmação na nuvem | Confiabilidade | Transações SQLite + idempotência + validação no Postgres |
| **RNF08** | Baixo acoplamento entre Módulo Financeiro e Módulo de Frota | Manutenibilidade | Pastas por feature; comunicação só via contratos explícitos |

**Nota sobre o RNF03:** o professor sugeriu Material Design, mas a exigência real é adotar
*um* guia consolidado. A equipe adotou o **DESIGN-CYAN**, documentado neste repo e aplicado
via tokens. Isso deve ser explicado na apresentação como decisão consciente, não como omissão.

---

## 5. Modelo de dados (9 entidades)

Postgres no Supabase, espelhado em SQLite local. Mantenha os **mesmos nomes** de entidades
e campos da especificação original — a banca vai comparar com o MER/DER.

```ts
type PerfilNome = 'Admin' | 'Gestor de Frota' | 'Financeiro' | 'Motorista';

Perfil            { id, nome: PerfilNome }
Usuario           { id, perfilId, nome, email, googleSubjectId, ativo }
Categoria         { id, titulo, tipo: 'Entrada' | 'Saida', ativa }        // ativa = soft delete
FormaPagamento    { id, nome }                                            // Pix, Boleto, Cartão, TED
Divida            { id, categoriaId, descricao, quantidadeParcelas,
                    valorParcela, dataVencimentoPrimeira }
Veiculo           { id, placa, marca, modelo, capacidadeCarga,
                    status: 'Disponivel' | 'EmViagem' | 'EmManutencao' }
Rota              { id, cidadeOrigem, cidadeDestino, distanciaEstimadaKm }
Viagem            { id, veiculoId, rotaId, motoristaId, hodometroInicial,
                    hodometroFinal, dataInicio, dataFim, status }
Movimentacao      { id, categoriaId, formaPagamentoId,
                    viagemId | null,      // null = despesa de escritório
                    dividaId | null,      // null = não é parcela
                    valor, descricao, dataInclusao, dataVencimento,
                    dataPagamento | null,
                    statusPagamento: 'Pendente' | 'Pago' }
```

**`Movimentacao` é o núcleo do sistema.** As FKs anuláveis `viagemId` e `dividaId` são a
ponte entre os módulos (US09) e o vínculo com parcelamentos (US04). Não as torne
obrigatórias.

### Regras de dados não negociáveis

- **Soft delete sempre.** Categorias, formas de pagamento e usuários nunca são removidos
  fisicamente — use a flag `ativa`/`ativo`. Itens inativos somem dos seletores mas
  continuam visíveis em lançamentos históricos.
- **IDs gerados no cliente (UUID v7).** Indispensável para criar registros offline sem
  colisão. Não dependa de sequência do Postgres.
- **Dinheiro nunca em `float`.** Use `numeric` no Postgres e inteiros em centavos no
  cliente — nunca ponto flutuante para valores financeiros.
- **Datas em `timestamptz`** no banco e ISO 8601 UTC no transporte; formate para o fuso
  local só na exibição.
- Toda tabela carrega `createdAt` e `updatedAt` — a sincronização depende disso.

---

## 6. Escopo funcional — Épicos e User Stories

### Épico 1 — Controle de Caixa e Financiamentos
- **US01** Gestão de Categorias (CRUD + soft delete, abas Entrada/Saída)
- **US02** Formas de Pagamento (Pix, Boleto, Cartão, TED; habilitar/desabilitar)
- **US03** Movimentações individuais com anexo de comprovantes (Supabase Storage)
- **US04** Módulo de Dívidas e Parcelamentos com **rollback transacional** — gerar N
  parcelas é atômico: ou todas nascem, ou nenhuma. Implementar como Postgres function.
- **US05** Motor de Saldo e Previsão de Caixa (view/function agregada)

### Épico 2 — Frota, Viagens e Inteligência de Rotas
- **US06** Cadastro de Frota
- **US06-b** Manutenção de veículos com **geração automática de despesa** vinculada
- **US07** Cadastro de Rotas
- **US08** Abertura e fechamento de Viagens com **validação de hodômetro** e suporte offline
- **US09** Ponte de módulos: vincular movimentações financeiras a viagens
- **US10** Motor de estatísticas de rota e **custo por KM**

### Épico 3 — Dashboards e BI
- **US11** Painel de indicadores (KPIs)
- **US12** Gráficos de fluxo de caixa mensal e rosca de despesas
- **US13** Ranking de eficiência logística
- **US14** Exportação de relatórios CSV/PDF com compartilhamento nativo

### Épico 4 — Segurança e Controle de Acesso (RBAC)
- **US15** Autenticação via Google SSO com sessão persistente
- **US16** Gestão de perfis de usuário
- **US17** Navegação contextual por cargo
- **US18** Segurança e validação de acesso **no servidor** — aqui: RLS policies

---

## 7. Padrões de arquitetura

### Estrutura de pastas

```
app/                        # expo-router — rotas por arquivo
  (auth)/login.tsx
  (gestor)/                 # Admin, Gestor de Frota, Financeiro
    home.tsx
    financeiro/
    frota/
    cadastros/
  (motorista)/              # somente rotinas de campo
    home.tsx
    viagem/
src/
  features/
    financeiro/             # US01–US05, US09
    frota/                  # US06–US08, US10
    dashboards/             # US11–US14
    auth/                   # US15–US18
  db/
    schema.ts               # Drizzle — espelho local do schema Postgres
    migrations/
    sync/                   # outbox, reconciliação, resolução de conflito
  supabase/
    client.ts               # cliente configurado com SecureStore adapter
    types.ts                # tipos GERADOS — nunca editados à mão
  ui/                       # primitivos + tokens + tema
  lib/                      # utils, formatadores, money, datas
packages/
  domain/                   # schemas Zod + tipos — COMPARTILHADO app ↔ Edge Functions
    mod.ts                  # barrel de exportação
    divida.ts
    viagem.ts
    movimentacao.ts
supabase/
  migrations/               # fonte de verdade do schema em nuvem (SQL)
  functions/
    deno.json               # import map: @eixo/domain → ../../packages/domain/mod.ts
    _shared/                # helpers de auth e conexão
    criar-divida/
docs/
  DESIGN-CYAN.md            # design system — NORMATIVO, fonte de verdade visual
  exemplos/                 # implementações de referência
  adr/                      # decisões de arquitetura
  specs/                    # spec.md / plan.md / tasks.md por US
```

**RNF08 na prática:** `features/financeiro` e `features/frota` **não importam uma da
outra**. O acoplamento acontece só em `features/financeiro/bridge` (US09), através de um
contrato explícito. Se precisar de um import cruzado, o contrato está faltando.

### Tipos do banco

Gere com a CLI: `supabase gen types typescript`. O resultado vai em `src/supabase/types.ts`
e **nunca é editado à mão**. Tipo de tabela digitado manualmente é dívida técnica imediata.

### Offline-first (RNF01 / RNF07) — o padrão obrigatório

1. **SQLite é a fonte de verdade da UI.** A tela lê do banco local, nunca direto do Supabase.
2. **Toda escrita é local e imediata**, dentro de uma transação, e enfileira uma operação
   na tabela `outbox` (`{ id, entidade, operacao, payload, tentativas, criadoEm }`).
3. **Sincronização em background** drena a outbox quando há conectividade
   (`expo-network` / `NetInfo`), com backoff exponencial.
4. **Idempotência:** toda operação carrega o UUID gerado no cliente e sobe como `upsert`.
   Reenviar a mesma operação não pode duplicar registro.
5. **Conflito:** last-write-wins por `updatedAt`, **exceto hodômetro e viagens**, onde o
   Postgres rejeita regressão e a operação vai para uma fila de revisão manual.
6. **A UI sempre mostra o estado de sincronização** (pendente / sincronizado / erro). O
   motorista precisa saber o que já subiu.

Escopo mínimo obrigatório de offline: **viagens e hodômetro (US08)**. Demais módulos podem
começar online-only e migrar.

### Validação de hodômetro (US08)

- `hodometroFinal > hodometroInicial`, sempre.
- `hodometroInicial` ≥ último `hodometroFinal` registrado para aquele veículo.
- Abertura e fechamento de viagem são transações atômicas locais.
- Nenhuma viagem fecha sem `hodometroFinal`.
- **Validar nos dois lados:** no cliente para feedback imediato, no Postgres para garantia.
  A validação do cliente é usabilidade; a do servidor é integridade.

### RBAC e navegação contextual (US17)

O perfil do usuário determina a árvore de rotas carregada, **não** apenas a visibilidade
de botões.

| Perfil | Acesso |
|---|---|
| Admin | Tudo, incluindo gestão de perfis |
| Gestor de Frota | Frota, viagens, rotas, dashboards de logística |
| Financeiro | Movimentações, dívidas, categorias, dashboards financeiros |
| Motorista | Apenas viagem atual, hodômetro, próxima rota. **Zero áreas financeiras** |

**O cliente esconde; o RLS decide.** Toda restrição visível na navegação precisa ter uma
policy equivalente no banco. Esconder a tela sem a policy correspondente **não é segurança**
— é só ocultação.

### Autenticação Google (US15)

- Supabase Auth com provider Google habilitado.
- No app: Google Sign-In nativo → `supabase.auth.signInWithIdToken()`.
- **Exige development build** (EAS). Não funciona no Expo Go — planeje isso antes da demo.
- Sessão persistida via adapter do `expo-secure-store`; `autoRefreshToken` ligado.
- Primeiro login cria/vincula a linha em `usuario` com perfil padrão **Motorista** (o
  perfil de menor privilégio). Promoção só por Admin (US16).
- Redirect URLs e client IDs configurados por ambiente no painel do Supabase.

---

## 8. Design System

> **Fonte de verdade visual: [`docs/DESIGN-CYAN.md`](./docs/DESIGN-CYAN.md)**
> Leia esse arquivo antes de criar qualquer componente. Ele é normativo — em caso de
> conflito com o que estiver escrito aqui, o DESIGN-CYAN vence para questões de cor,
> tipografia, espaçamento e forma; este CLAUDE.md vence para as adaptações de mobile
> listadas abaixo.

Identidade: canvas stone quente, cartões brancos com borda hairline de 1px, **um único
acento cyan**, tipografia Inter, contenção deliberada. Não usamos biblioteca de UI
opinativa — o visual é contido o bastante para que sobrescrever os defaults de uma lib
daria mais trabalho que construir os primitivos.

**Não existe protótipo Figma.** A referência visual é o design system, não um arquivo de
layout. Se uma tela precisar de uma decisão que o guia não cobre, resolva pelos tokens e
documente a escolha em `src/ui/`.

### Biblioteca de primitivos

Construa em `src/ui/` e use **só** eles nas telas: `Screen`, `Text`, `Button`, `Card`,
`Input`, `ListItem`, `Switch`, `Badge`, `Tabs`, `FAB`, `EmptyState`, `SyncStatus`.

Nenhuma tela cria estilo visual próprio. Se um componente não existe, crie o primitivo
antes de criar a tela.

### Tokens

```ts
export const colors = {
  canvas:      '#fafaf9',  // fundo de página — nunca use #ffffff como fundo
  surface:     '#ffffff',  // cartões e superfícies elevadas
  border:      '#e8e6e5',  // hairline 1px — o principal recurso estrutural
  borderMuted: '#d6d3d1',
  textMuted:   '#a8a29e',  // helper text, ícones desabilitados
  textBody:    '#78716c',  // corpo, labels secundários
  textPrimary: '#0c0a09',  // títulos e ênfase
  inverted:    '#1c1917',  // superfícies invertidas (uso raro)
  accentWash:  '#c1e1f7',  // fundo do highlight
  accent:      '#3ba6f1',  // CTA primária e ícones — único acento cromático
  accentEdge:  '#3398e1',  // bordas de ação e links
};

export const spacing = { xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48 };

export const radius = { icon: 4, input: 6, card: 10, feature: 16, pill: 9999 };
```

### Escala tipográfica adaptada para mobile

O guia original foi escrito para web (display de 52px). A proporção e a contenção se
mantêm; os tamanhos não:

| Papel | Tamanho | Line height | Peso |
|---|---|---|---|
| display | 32 | 1.15 | 400 |
| heading | 24 | 1.25 | 400 |
| subheading | 20 | 1.2 | 400/500 |
| body | 15 | 1.55 | 400 |
| body-sm | 13 | 1.5 | 400 |
| caption | 11 | 1.4 | 400 |

Fonte: **Inter** para tudo, carregada com `expo-font`. Roobert é proprietária — para
títulos, use **Inter Tight** ou o próprio Inter com tracking negativo.

### Regras visuais

**Faça:**
- Fundo `#fafaf9`, cartões `#ffffff`. Nunca o inverso.
- Bordas de 1px `#e8e6e5` como separador estrutural principal, não sombras.
- Botões em formato pílula (radius 9999), padding 8/16.
- Um único elemento preenchido com cyan por tela — a ação primária.
- Títulos em peso 400. Ênfase vem de tamanho e do highlight, não de peso 700.

**Não faça:**
- Não introduza novas cores de acento. Neutros stone + um cyan, ponto final.
- Verde e vermelho aparecem **apenas** como estado semântico de entrada/saída financeira,
  em uso mínimo — nunca como paleta decorativa.
- Não use gradientes, glassmorphism ou sombras pesadas em cartões de conteúdo.
- Não empilhe múltiplos highlights cyan no mesmo título.

### Traduzindo o guia (web) para o app (mobile)

O DESIGN-CYAN foi extraído de uma **landing page**. Metade dos componentes catalogados
nele é linguagem de marketing e **não tem lugar nenhum** num app de gestão de frota. Use
esta tabela antes de abrir o guia:

| Componente do guia | No app |
|---|---|
| Primary CTA Button (cyan preenchido) | ✅ Ação primária de tela e do FAB |
| Secondary Ghost Button | ✅ Ações secundárias, cancelar |
| Flat Content Card | ✅ **O componente mais usado** — cartão de saldo, veículo, viagem, lançamento |
| Text Input | ✅ Todos os formulários |
| Tab Pill Group | ✅ Abas Entrada/Saída em Categorias (US01), filtros de período |
| Highlighted Text Span | ⚠️ Só em título de dashboard, no KPI principal. Nunca em lista |
| Floating Dashboard Preview | ⚠️ Vira o cartão de destaque do topo da Home. Uma vez por tela |
| Navigation Link | ⚠️ Adaptar para bottom tab bar — não existe top nav em mobile |
| Logo Wordmark | ⚠️ Só na tela de Login e no header da Home |
| Testimonial Card | ❌ Não existe |
| Star Rating Display | ❌ Não existe |
| Signed-in Avatar Link (cluster) | ❌ Não existe. Avatar único no perfil, sim |
| Mascot Sticker Illustration | ❌ Não existe. Personalidade vem do empty state, não de mascote |

### Ajustes obrigatórios do guia para mobile

O guia é de web e algumas regras dele quebram em tela pequena:

- **Section gap de 96px → 24/32px.** O ritmo editorial amplo não cabe num celular; a
  contenção se mantém pelo espaço em branco dentro do cartão, não entre seções.
- **Page max-width de 1200px → irrelevante.** Use padding lateral de 16px e deixe o
  conteúdo fluir (RNF02).
- **Alvo de toque mínimo de 44×44pt.** O guia foi feito para mouse. Switch de soft delete,
  linha de lista e ícone de ação precisam respeitar isso mesmo que o visual pareça menor.
- **Nada de `filter: grayscale()`.** É CSS de web e não existe em React Native.
- O **highlight span** vira um `View` com fundo `accentWash` e radius 4 envolvendo o
  `Text`, não um `<span>`.

### Cores semânticas — a única exceção à paleta

O guia proíbe cores novas, e a proibição vale. A exceção é o **estado financeiro**, que é
informação, não decoração:

- Entrada / receita: o próprio `accent` (#3ba6f1) ou um verde discreto usado **apenas** no
  valor e no ícone.
- Saída / despesa: vermelho discreto, **apenas** no valor.
- Nunca pinte o cartão inteiro, a borda ou o fundo com essas cores.
- Nunca use cor como único indicador — acompanhe sempre de sinal (`+` / `−`) ou rótulo,
  porque cor sozinha falha para daltônicos e sob sol forte na cabine do caminhão.

### Telas a construir

O protótipo Figma foi **descartado**. As telas são derivadas direto do design system e das
user stories:

Login (US15) · Home Admin/Gestor · Home Motorista (US17) · Cadastros · Categorias com abas
Entrada/Saída e switch de soft delete (US01) · Nova/Editar Categoria · Formas de Pagamento
(US02) · Perfis de Usuário (US16) · Lançamentos (US03) · Dívidas (US04) · Veículos (US06) ·
Rotas (US07) · Viagem/Hodômetro (US08) · Dashboards (US11–13).

Ao criar uma tela nova, o fluxo é: identificar os primitivos necessários → construir o que
faltar em `src/ui/` → montar a tela **só** com primitivos. Nenhuma tela define estilo visual
próprio.

---

## 9. Metodologia e governança

- **Spec-Driven Development:** cada US tem `spec.md`, `plan.md` e `tasks.md` em
  `docs/specs/`, integrados a GitHub Projects e Issues.
- **Intent-Driven Development:** *Acceptance Briefs* com critérios de aceite observáveis
  (`AC-NNN`). Nada de critério ambíguo — a equipe é iniciante e ambiguidade vira retrabalho.
- **Sprints Scrum bi-semanais** com entregas incrementais.

### Git

- `main` **bloqueada** para commit direto. Só entra via PR aprovado.
- Branch por feature: `feat/US03-lancamento-movimentacoes`.
- Commits no padrão **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`).
- PR exige: descrição do que muda, referência à US, print/vídeo quando houver mudança de UI.
- **PR que cria tabela sem RLS policy não é aprovado.**
- **PR que altera schema em nuvem sem a migration local correspondente não é aprovado.**
- Code review do Tech Lead obrigatório.

---

## 10. Roadmap (2026)

| Data | Sprint | Entrega |
|---|---|---|
| 21/08 | S1 — Discovery e Setup | Arquitetura, UI/UX, repositório, banco inicial, Login Google (US15) |
| 04/09 | S2 — Fundações e RBAC | MER/DER, Categorias (US01), Formas de Pagamento (US02), Perfis (US16–18) |
| **14/09** | **Entrega Parte 1** | Apresentação + demo do app rodando |
| 18/09 | S3 — Core Financeiro I | Lançamentos e anexos (US03) |
| 02/10 | S4 — Core Financeiro II | Motor de Saldo (US05), Dívidas com rollback (US04) |
| 16/10 | S5 — Frota e Viagens | Veículos e Rotas (US06–07), hodômetro (US08) |
| 30/10 | S6 — Integração | Ponte de módulos (US09), custo por KM (US10) |
| 13/11 | S7 — Visualização e BI | Dashboards (US11–13), exportação (US14) |
| 27/11 | S8 — Lançamento | Testes sistêmicos, usabilidade, preparação de banca |
| 08/12 | Homologação | Entrega final |

---

## 11. Comandos

```bash
npm install
npx expo start                      # dev server (exige development build para Google SSO)
npx expo run:android                # build local Android
eas build --profile development --platform android

supabase start                      # stack local (Docker)
supabase migration new <nome>       # nova migration de nuvem
supabase db push                    # aplicar migrations
supabase gen types typescript --local > src/supabase/types.ts

supabase functions serve            # Edge Functions localmente
supabase functions deploy criar-divida

npx drizzle-kit generate            # migration do SQLite local
npm run lint && npm run typecheck
npm test
```

---

## 12. Instruções para o agente de IA

**Sempre:**
- Escreva em **TypeScript strict**. Sem `any`, sem `@ts-ignore` sem justificativa em comentário.
- Nomes de domínio em **português**, seguindo a especificação (`Movimentacao`,
  `hodometroInicial`). Código de infraestrutura em inglês. Não misture dentro da mesma entidade.
- Antes de implementar uma US, leia o `spec.md` correspondente em `docs/specs/`.
- **Toda tabela nova vem com RLS policy no mesmo PR.** Sem policy, o dado está exposto.
- Toda escrita de dados do motorista passa pelo fluxo offline-first da seção 7.
- **Antes de criar qualquer componente visual, leia `docs/DESIGN-CYAN.md`.** Ele é
  normativo. Não invente tratamento visual que não esteja nele.
- Use os tokens e primitivos da seção 8. Nunca hardcode hex de cor, spacing ou radius em tela.
- Valide entrada com Zod nos limites (formulário e resposta do Supabase).
- **Schema de domínio mora em `packages/domain/` e é importado pelos dois lados.** Nunca
  duplique uma validação entre app e Edge Function — se duplicou, elas vão divergir.
- Operação que escreve em mais de uma tabela vira Edge Function com transação. Escrita
  simples continua indo direto via `supabase-js`.
- Comente o **porquê**, não o quê. A equipe é iniciante — explicar decisão vale mais que
  descrever sintaxe.

**Nunca:**
- Nunca coloque a chave `service_role` no app, em `.env` público ou em qualquer arquivo versionado.
- Nunca guarde sessão ou dado sensível em `AsyncStorage` — use `expo-secure-store`.
- Nunca faça `DELETE` físico em Categoria, Forma de Pagamento ou Usuário — soft delete.
- Nunca use `float` para dinheiro.
- Nunca confie no cliente para autorização — a policy no banco é a autoridade (US18).
- Nunca escreva tipos de tabela à mão — gere com `supabase gen types`.
- Nunca faça agregação de dashboard no cliente — ela mora numa view (RNF06).
- Nunca crie import cruzado entre `features/financeiro` e `features/frota` (RNF08).
- Nunca introduza dependência pesada sem registrar um ADR em `docs/adr/`.

**Em caso de dúvida:** pergunte antes de assumir. Uma pergunta custa um minuto; uma
suposição errada custa uma sprint.
