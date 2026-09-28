# AGENTS.md — Eixo App

Instruções obrigatórias para qualquer agente de IA (Claude Code, Cursor, Copilot) que trabalhe neste repositório. **Leia este arquivo inteiro antes da primeira edição de código.**

---

## 0. Ritual de início — sempre, sem exceção

Antes de escrever qualquer linha de código, nesta ordem:

1. Leia `DESIGN_CYAN.md` na raiz. É a fonte única de verdade visual do projeto.
2. Liste e carregue as skills relevantes em `.claude/skills/`.
3. Leia a task do Linear que o usuário indicou (identificador `EIX-XX`) e trate os critérios de aceite como especificação.
4. Só então planeje e escreva.

**Spec-Driven.** Para feature nova ou US (não para ajuste pontual), use a skill `tlc-spec-driven`: ela conduz Specify → Design → Tasks → Execute e grava os artefatos em `.specs/` (`.specs/features/<feature>/`, `STATE.md`, `LESSONS.md`). Os critérios de aceite da task do Linear são a entrada da fase Specify.

Pré-requisito: **Python 3** no PATH — a skill roda scripts de validação de spec, tasks e mensagem de commit. No Windows o comando pode ser `py` ou `python` em vez de `python3`.

Se `DESIGN_CYAN.md` ou `.claude/skills/` não existirem no diretório atual, **pare e avise o usuário** em vez de improvisar um estilo próprio.

---

## 1. Contexto do projeto

App mobile de gestão financeira e controle de frota para transportadoras.

- **Frontend:** React Native + Expo, TypeScript `strict`, `expo-router`
- **Backend/BD:** Supabase (PostgreSQL), autenticação via Google SSO
- **Estado:** Zustand
- **Testes:** Jest (`jest-expo`) + Testing Library
- **Offline:** arquitetura offline-first nas rotinas do motorista

Módulos: Caixa (movimentações, dívidas, saldo), Frota (veículos, manutenção, rotas, viagens), BI (KPIs, gráficos, rankings), RBAC (4 perfis).

---

## 2. Regras de código

### 2.1 Visual — o mais importante

- **Zero valores hardcoded.** Nada de `color: '#3ba6f1'`, `padding: 16`, `fontSize: 14` soltos. Tudo vem de `src/ui/tokens.ts`.
- Reutilize os primitivos de `src/ui/`: `Screen`, `Text`, `Button`, `Card`. **Não crie um botão novo.** Se o primitivo não atende, estenda-o com uma variante e avise o usuário.
- Alvo mínimo de toque: 44pt.
- Todo layout precisa funcionar em smartphone pequeno, grande e tablet.
- Toda ação do usuário (salvar, excluir, erro) retorna feedback visual: loading no botão, Snackbar de sucesso, Snackbar de erro. Sem exceção.
- Estados obrigatórios em toda tela de dados: **carregando**, **vazio**, **erro**, **sucesso**.

### 2.2 TypeScript

- `strict: true`. **`any` é proibido** — use `unknown` + narrowing se necessário.
- Tipos do banco vêm do arquivo gerado por `supabase gen types`; não redeclare tipos de tabela na mão.
- Validação de formulário com Zod, com mensagens de erro **em português**.

### 2.3 Estrutura de pastas

```
src/
  app/          # rotas do expo-router
  features/     # um diretório por módulo (categorias, movimentacoes, viagens...)
  ui/           # primitivos e tokens — área compartilhada, mexer com cuidado
  lib/          # supabase, storage, offline, helpers
  types/        # tipos gerados
```

Cada feature é autocontida: componentes, hooks, queries e testes dentro da própria pasta.

### 2.4 Dados e segurança

- Toda tabela tem RLS ativo. Nunca desabilite RLS para "fazer funcionar".
- Regra de negócio crítica é validada **no banco também**, não só no formulário.
- Operações que criam múltiplos registros (parcelas de dívida, manutenção + movimentação) rodam em transação/RPC com rollback.
- Segredo nunca entra no código. Só em `.env` (não versionado) e `.env.example` com os nomes das chaves.

### 2.5 Testes

Toda task entrega teste. No mínimo: render do componente, o caminho feliz e as validações citadas nos critérios de aceite.

---

## 3. Regras de Git — o agente também segue

- **Nunca commite na `main`.** Ela é protegida; a tentativa vai falhar.
- Antes de começar: `git checkout main && git pull origin main && git checkout -b <branch da task>`
- O nome da branch está escrito no rodapé da task no Linear. Use exatamente aquele.
- Commits no padrão `tipo(escopo): descrição` — `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Todo código entra por Pull Request, com **1 aprovação obrigatória** de outro dev.
- Merge sempre por **Squash and merge**.
- **Não faça `git push --force`.** Nunca.
- **Não resolva conflito de merge sozinho** se o conflito envolver código de outra pessoa: mostre o conflito ao usuário e peça orientação.

---

## 4. Limites do agente

Faça:
- Implementar o que está nos critérios de aceite da task.
- Escrever os testes correspondentes.
- Apontar quando um critério estiver ambíguo ou contraditório — **pergunte antes de adivinhar**.

Não faça:
- Refatorar código fora do escopo da task.
- Instalar dependência nova sem confirmar com o usuário.
- Alterar `src/ui/`, `supabase/migrations/` já aplicadas, ou configuração de CI sem pedir autorização explícita.
- Criar arquivos de documentação, README ou resumos que ninguém pediu.
- Marcar a task como concluída. Quem fecha é a pessoa.

---

## 5. Antes de dizer "terminei"

Rode e confirme que passa:

```bash
npm run typecheck
npm run lint
npm run test
```

E confira:

- [ ] Todos os critérios de aceite da task atendidos
- [ ] Nenhum valor visual hardcoded
- [ ] Loading, vazio e erro tratados
- [ ] Validação impedindo dado inválido
- [ ] Testes escritos e verdes
- [ ] Nada fora do escopo da task foi alterado

Depois, resuma para o usuário **o que mudou e o que ele precisa revisar manualmente** antes de abrir o PR.
