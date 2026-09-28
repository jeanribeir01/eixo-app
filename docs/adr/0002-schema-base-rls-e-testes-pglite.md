# ADR 0002 — Schema base com RLS via `auth_perfil()` e testes em PGlite

- **Status:** Aceito
- **Data:** 2026-09-24
- **US:** EIX-27
- **Decisões relacionadas:** `.specs/STATE.md` AD-004, AD-005, AD-006

## Contexto

A EIX-27 cria o schema inteiro do domínio (10 tabelas) numa única entrega, para que as US01–US14
não criem tabela própria e divirjam do MER. Três decisões de arquitetura atravessam todas as
migrations e precisam ficar registradas: como as policies de RLS descobrem o perfil do usuário
logado, se o espelho local em SQLite/Drizzle entra nesta entrega, e como testar constraints e
policies sem depender de Docker (AD-003 já proíbe stack local em container).

## Decisão

1. **`auth_perfil()` em vez de custom claim no JWT.** Toda policy de RLS chama a function
   `auth_perfil() returns perfil_nome`, que lê `usuario.perfil_id` a partir de `auth.uid()`.
   `security definer` + `set search_path = ''` evita recursão de RLS na própria tabela `usuario` e
   fixa o schema resolvido. A alternativa — custom claim populada por Auth Hook — é mais rápida por
   não rodar `select` a cada policy, mas exige configurar o Hook no painel do Supabase e só reflete
   troca de perfil depois do token renovar. No volume deste projeto, o `select` extra por policy é
   um custo aceitável frente a essa defasagem.
2. **Drizzle/SQLite adiado, exceção registrada ao CLAUDE.md.** O CLAUDE.md pede migration local
   espelhada em todo PR de schema, mas Drizzle não está instalado no repo e o offline-first é
   escopo da US08, não da EIX-27. Criar o espelho agora seria escrever uma segunda definição de
   schema sem nenhum consumidor ainda.
3. **PGlite como harness de teste.** `@electric-sql/pglite` sobe um Postgres real em WASM dentro do
   Jest, sem Docker. Um stub mínimo (`supabase/tests/helpers/supabase-stubs.sql`) recria só o que as
   migrations reais precisam de `auth.*` e `storage.*` — nunca é aplicado na nuvem.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `@electric-sql/pglite` (devDependency) | Postgres real em WASM para testar migrations e RLS sem Docker |

## Alternativas consideradas

- **Custom claim no JWT via Auth Hook:** mais performática, mas exige Auth Hook configurado por
  ambiente e não reflete troca de perfil até o token renovar. Rejeitada para esta entrega; pode
  substituir `auth_perfil()` depois se o `select` por policy virar gargalo medido.
- **Espelhar o schema em Drizzle/SQLite já nesta entrega:** rejeitada porque a dependência não está
  instalada e não há tela consumindo offline ainda; motivaria uma segunda fonte de verdade sem uso.
- **Testar as migrations só via `supabase db push` num projeto de teste na nuvem:** mais fiel ao
  Supabase real, mas exige rede, Docker ou um projeto compartilhado a cada teste — inviável para
  rodar no `npm test` local. PGlite prova as regras SQL localmente; o `db push` real continua sendo
  a validação final antes de gerar os tipos (T9).

## Consequências

- Toda policy de RLS paga um `select` extra (`auth_perfil()`) por avaliação; aceitável no volume
  atual, mas deve ser revisto se dashboards ficarem lentos (RNF06).
- O stub do PGlite é uma aproximação do Supabase real — roles, `auth.uid()` e `storage.*`
  simplificados. Os testes provam as regras escritas em SQL; a aplicação real ainda depende do
  `db push` (T9) para pegar diferenças de ambiente que o stub não replica.
- `@electric-sql/pglite` só carrega com a flag `--experimental-vm-modules` do Node, que quebra o
  resto da suíte Jest se aplicada ao processo inteiro — por isso `npm test` roda o projeto Jest
  `app` e o projeto `supabase` em dois processos `node` separados (ver `package.json`).
- O espelho SQLite/Drizzle fica como débito registrado, não esquecido: entra junto com o
  offline-first da US08.

## Links

- `.specs/features/eix27-schema-base/design.md`
- `.specs/features/eix27-schema-base/spec.md` (seção Out of Scope, linha do Drizzle)
- Segue o formato de [`docs/adr/0001-google-signin-nativo-e-sessao-securestore.md`](./0001-google-signin-nativo-e-sessao-securestore.md)
