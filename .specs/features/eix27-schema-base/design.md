# EIX-27 — Schema base Design

**Spec:** `.specs/features/eix27-schema-base/spec.md` · **Decisões:** AD-004, AD-005, AD-006 em `.specs/STATE.md`

## Visão geral

```
supabase/
  config.toml                          # gerado por `npx supabase init`
  migrations/
    20260924000100_base_perfil_usuario.sql   # enums, trigger de data, perfil, usuario, auth_perfil(), handle_new_user
    20260924000200_catalogos.sql             # categoria, forma_pagamento + seeds
    20260924000300_frota.sql                 # veiculo, rota, viagem, manutencao
    20260924000400_financeiro.sql            # divida, movimentacao
    20260924000500_rls.sql                   # enable RLS + policies das 10 tabelas
    20260924000600_storage_comprovantes.sql  # bucket + policies em storage.objects
  tests/
    helpers/supabase-stubs.sql         # só para teste: roles, auth.users, auth.uid(), storage.*
    helpers/db.ts                      # cria PGlite, aplica stubs + migrations, troca de usuário
    *.test.ts                          # um arquivo por migration
src/types/database.ts                  # gerado: `npx supabase gen types typescript --linked`
```

A ordem das migrations segue as FKs: `movimentacao` referencia `viagem` e `divida`, então frota e
dívida vêm antes dela. RLS fica numa migration própria para que o revisor leia todas as policies
num só lugar.

## Decisões

### Funções auxiliares (migration 1)

- `set_data_atualizacao()` — trigger `before update` que grava `now()` em `data_atualizacao`. Uma
  trigger por tabela, todas usando a mesma função.
- `auth_usuario_id()` = `auth.uid()`. Existe para as policies lerem como no CLAUDE.md.
- `auth_perfil() returns perfil_nome` — `select p.nome from usuario u join perfil p ... where u.id = auth.uid() and u.ativo`.
  `security definer` + `set search_path = ''` + `stable`, para a consulta não cair na RLS de
  `usuario` (recursão) e ninguém trocar o `search_path`.
- `handle_new_user()` — trigger `after insert on auth.users` que cria `usuario` com perfil
  Motorista, `nome` = `raw_user_meta_data->>'full_name'` (fallback: e-mail), `google_subject_id` =
  `raw_user_meta_data->>'sub'`. `security definer`.

Escolhida a função `auth_perfil()` em vez de custom claim no JWT (CLAUDE.md pede registrar):
não exige Auth Hook e a troca de perfil vale na hora, sem esperar o token renovar. Custo: um
`select` por policy avaliada; aceitável no volume do projeto.

### Tabelas

Todas: `id uuid primary key default gen_random_uuid()` (exceto `usuario.id`, que é FK para
`auth.users.id` com `on delete restrict`), `data_inclusao timestamptz not null default now()`,
`data_atualizacao timestamptz not null default now()`.

| Tabela | Colunas de domínio | Regras |
|---|---|---|
| perfil | `nome perfil_nome unique` | — |
| usuario | `perfil_id`, `nome`, `email`, `google_subject_id`, `ativo bool default true` | `email` único |
| categoria | `titulo`, `tipo tipo_categoria`, `ativa bool default true` | `unique (titulo, tipo)` |
| forma_pagamento | `nome unique`, `ativa bool default true` | — |
| veiculo | `placa`, `marca`, `modelo`, `capacidade_carga numeric(10,2)`, `status status_veiculo default 'Disponivel'` | `placa` gravada em maiúsculas sem espaços (check `placa = upper(replace(placa,' ',''))`) + `unique` |
| rota | `cidade_origem`, `cidade_destino`, `distancia_estimada_km numeric(10,2) > 0` | — |
| viagem | `veiculo_id`, `rota_id`, `motorista_id → usuario`, `hodometro_inicial numeric(12,1) >= 0`, `hodometro_final`, `data_inicio`, `data_fim`, `status status_viagem default 'EmAndamento'` | `hodometro_final is null or > inicial`; `status <> 'Finalizada' or hodometro_final is not null` |
| manutencao | `veiculo_id`, `descricao`, `data_manutencao date`, `valor numeric(12,2) >= 0`, `hodometro`, `movimentacao_id` (nullable, FK adicionada na migration 4) | — |
| divida | `categoria_id`, `descricao`, `quantidade_parcelas int > 0`, `valor_parcela numeric(12,2) >= 0`, `data_vencimento_primeira date` | — |
| movimentacao | `categoria_id`, `forma_pagamento_id`, `viagem_id?`, `divida_id?`, `valor numeric(12,2) >= 0`, `descricao`, `data_vencimento date?`, `data_pagamento date?`, `status_pagamento default 'Pendente'` | `status_pagamento <> 'Pago' or data_pagamento is not null` |

Placa normalizada por check (e não por trigger que converte): o banco rejeita `abc1d23` e o
cliente normaliza antes de enviar. Assim "placa repetida" e "placa em formato errado" dão erros
diferentes e ninguém grava duas versões da mesma placa. Cobre o edge case de caixa/espaço.

### Policies (migration 5)

Tabela de acesso — `auth_perfil() in (...)`:

| Tabela | select | insert / update | delete |
|---|---|---|---|
| perfil | autenticado | Admin | — |
| usuario | `id = auth.uid()` ou Admin, Gestor de Frota | Admin | — |
| categoria, forma_pagamento | Admin, Financeiro | Admin, Financeiro | — |
| divida, movimentacao | Admin, Financeiro | Admin, Financeiro | Admin, Financeiro |
| veiculo, rota | autenticado | Admin, Gestor de Frota | Admin, Gestor de Frota |
| manutencao | Admin, Gestor de Frota | Admin, Gestor de Frota | Admin, Gestor de Frota |
| viagem | Admin, Gestor ou `motorista_id = auth.uid()` | Admin, Gestor ou (Motorista e `motorista_id = auth.uid()`) | Admin, Gestor de Frota |

"autenticado" = `to authenticated`. Nenhuma policy para `anon` → não autenticado vê zero linhas.
Sem policy de delete = delete rejeitado (soft delete).

### Storage (migration 6)

`insert into storage.buckets (id, name, public) values ('comprovantes','comprovantes', false) on conflict do nothing`.
Policies em `storage.objects` para `select/insert/update/delete` com
`bucket_id = 'comprovantes' and public.auth_perfil() in ('Admin','Financeiro')`.

### Testes com PGlite

- Cada arquivo de teste começa com `/** @jest-environment node */` — o preset `jest-expo` usa
  ambiente React Native, e o PGlite precisa de Node (WASM + fs).
- `supabase-stubs.sql` recria o mínimo do Supabase: roles `anon`/`authenticated`,
  `auth.users (id, email, raw_user_meta_data)`, `auth.uid()` lendo
  `current_setting('request.jwt.claim.sub', true)`, `storage.buckets` e `storage.objects` com RLS,
  e `grant` das tabelas de `public` para `authenticated`/`anon` (o Supabase faz isso por padrão).
  **Nunca** é aplicado na nuvem.
- `db.ts` exporta `criarBanco()` (PGlite novo + stubs + migrations em ordem de nome) e
  `comoUsuario(db, perfil)` (cria usuário em `auth.users`, promove o perfil como superuser e
  roda a consulta em transação com `set local role authenticated` + `set local request.jwt.claim.sub`).
- Limite honesto: o stub não é o Supabase real. Os testes provam as regras que escrevemos em SQL;
  a aplicação no projeto real é conferida pelo `db push` e pela geração de tipos.

### Tipos

`npx supabase gen types typescript --linked --schema public > src/types/database.ts`, depois do
`db push`. Arquivo nunca editado à mão.

## Riscos

| Risco | Mitigação |
|---|---|
| PGlite não carregar no Jest (ESM/WASM) | T1 prova o harness com um teste mínimo antes de qualquer migration |
| `db push` falhar no projeto real por diferença com o stub | Migrations usam só SQL padrão + objetos que o Supabase garante (`auth.users`, `storage.*`); push roda antes dos tipos |
| Recursão de RLS em `usuario` | `auth_perfil()` é `security definer` |
