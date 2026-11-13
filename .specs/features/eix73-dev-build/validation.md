# EIX-73 · Development build no celular — Validação

**Verdict**: PASS
**Result**: PASS

**Data**: 2026-11-13
**Spec**: `.specs/features/eix73-dev-build/spec.md`
**Diff range**: `9cbe513..d99c83d` (branch `chore/eix-73-dev-build-celular`, 5 commits: `278b4c8`, `614388e`, `6bfe5d7`, `239d319`, `d99c83d`)
**Verifier**: sub-agente independente (autor ≠ verificador)

Superfície do diff: `src/features/auth/googleAuth.ts`, `app/_layout.tsx`, `jest.setup.ts`, `eas.json`, `app.config.ts`, `README.md`, `__tests__/routes/avisoExpoGo.test.tsx`, `src/features/auth/__tests__/googleAuthExpoGo.test.ts` e a própria spec.

---

## Conclusão das tarefas

Não há `tasks.md` nesta feature. A conferência foi feita direto contra os ACs DEV-01..DEV-09 da spec e contra os commits do diff.

---

## Critérios de aceite ancorados na spec

### P1 — Aviso no Expo Go

| ID | Resultado definido na spec | `file:line` + asserção | Resultado |
| --- | --- | --- | --- |
| DEV-01 | No Expo Go, título "Este app não abre no Expo Go" e descrição que manda instalar o app de desenvolvimento e cita a seção "Rodar no celular" | `__tests__/routes/avisoExpoGo.test.tsx:38` `getByText('Este app não abre no Expo Go')`; `:39` `getByText(/instale o app de desenvolvimento/i)`; `:40` `getByText(/"Rodar no celular"/)`; `:41` a rota `Tela Inicial` não aparece. Código: `app/_layout.tsx:23`, `:44-47` | ✅ (M2, M5) |
| DEV-02 | No Expo Go, esconder a splash e não chamar `configureGoogleSignIn` | `__tests__/routes/avisoExpoGo.test.tsx:49` `expect(SplashScreen.hideAsync).toHaveBeenCalled()`; `:50` `expect(configureGoogleSignIn).not.toHaveBeenCalled()`. Código: `app/_layout.tsx:34-36` | ✅ (M2, M3, M4) |
| DEV-03 | Importar `googleAuth.ts` não avalia `@react-native-google-signin/google-signin`; o módulo só carrega quando uma função de login é chamada | `src/features/auth/__tests__/googleAuthExpoGo.test.ts:16` `expect(() => jest.requireActual('../googleAuth')).not.toThrow()` com o módulo do Google mockado para lançar ao ser avaliado (`:9-11`); `:22` `expect(() => configureGoogleSignIn()).toThrow(ERRO_EXPO_GO)`. Código: `src/features/auth/googleAuth.ts:1` (só `import type`), `:13-16` (`require` sob demanda) | ✅ (M1) |
| DEV-04 | Fora do Expo Go, fluxo atual: configura o Google e monta as rotas | `__tests__/routes/avisoExpoGo.test.tsx:58` `expect(configureGoogleSignIn).toHaveBeenCalledTimes(1)`; `:59` aviso ausente. "Monta as rotas": `__tests__/routes/authGuard.test.tsx:114` `findByText('Tela Login')`, com `isRunningInExpoGo` = `false` pelo mock global em `jest.setup.ts:33`. As outras suítes que renderizam o `RootLayout` (`authGuard`, `erroDeMigration`, `navegacaoPorPerfil`) continuam verdes | ✅ |

### P1 — Build de desenvolvimento e guia

Critérios de configuração e documentação: verificados por leitura e, no `eas.json`, por parse do JSON (`py -3`: `True internal apk`).

| ID | Resultado definido na spec | `file:line` | Resultado |
| --- | --- | --- | --- |
| DEV-05 | Perfil `development` com `developmentClient: true`, `distribution: "internal"`, `android.buildType: "apk"` | `eas.json:7-12` | ✅ |
| DEV-06 | `extra.eas.projectId` em `app.config.ts`, gerado pelo `eas init` | `app.config.ts:62-66` (`projectId: 'b8f78fcf-a8dc-4522-a569-81684e85d982'`, UUID válido) e `owner` em `:61`. Que o id veio do `eas init` não dá para conferir sem a conta Expo | ✅ |
| DEV-07 | Seção "Rodar no celular": APK do EAS ou `npx expo run:android --device` pelo USB; abrir o app Eixo Certo (não o Expo Go); Metro na mesma rede Wi-Fi | `README.md:318` (seção), `:324-331` (Opção A: APK do EAS, mesma rede Wi-Fi em `:329`, "Abra o app **Eixo Certo** no celular (não o Expo Go)" em `:330`), `:333-338` (Opção B: `npx expo run:android --device` em `:337`); índice em `:35` | ✅ |
| DEV-08 | Aviso de que o Expo Go não funciona; PR que adiciona dependência nativa exige build novo, avisado na descrição | `README.md:76-79` e `:320` (Expo Go não funciona); `:346-349` e `:491-492` (regra do PR: "⚠️ Exige build novo do app de desenvolvimento" na descrição) | ✅ |
| DEV-09 | APK do EAS instalado no celular: login com Google funciona (SHA-1 do EAS no client OAuth Android) | Checagem manual do Jean. README orienta em `:256-260` e `:342-344` | ⏳ manual, pendente |

**Status**: ✅ DEV-01..DEV-08 cobertos com evidência; DEV-09 é manual e fica pendente com o Jean (não reprova a feature).

---

## Discrimination Sensor

Rodado em worktree temporária (`git worktree add $TEMP/eix73-sensor HEAD` + junction para `node_modules`). Testes alvo: `src/features/auth/__tests__`, `__tests__/routes/avisoExpoGo.test.tsx`, `__tests__/routes/authGuard.test.tsx` (baseline no scratch: 106/106 verdes). Cada mutação foi revertida com `git checkout -- .` dentro do scratch.

| Mutação | Arquivo:linha | Descrição | Morto? |
| --- | --- | --- | --- |
| M1 | `src/features/auth/googleAuth.ts:1` | Volta o `import { GoogleSignin } from '@react-native-google-signin/google-signin'` estático no topo | ✅ Morto (2 falhas: os dois testes DEV-03) |
| M2 | `app/_layout.tsx:23` | Remove o ramo `if (isRunningInExpoGo()) return <AvisoExpoGo />` | ✅ Morto (2 falhas: DEV-01 e DEV-02) |
| M3 | `app/_layout.tsx:35` | Tira o `SplashScreen.hideAsync()` do `AvisoExpoGo` | ✅ Morto (1 falha: DEV-02) |
| M4 | `app/_layout.tsx:35` | Chama `configureGoogleSignIn()` dentro do `AvisoExpoGo` | ✅ Morto (1 falha: DEV-02) |
| M5 | `app/_layout.tsx:44` | Troca o título do aviso por "Abra no app certo" | ✅ Morto (1 falha: DEV-01) |

**Sensor depth**: leve (5 mutações, cobrindo os dois ramos do layout e o carregamento sob demanda)
**Sensor**: 5/5 mortos, 0 sobreviventes.

Isolamento: `git status --porcelain` do repositório real vazio antes e depois; junction removida antes do `git worktree remove --force` e `git worktree prune`; `node_modules` real intacto.

---

## Code Quality

| Princípio | Status |
| --- | --- |
| Código mínimo | ✅ `googleAuth.ts` troca só o import por um `require` sob demanda; o layout ganha um ramo e um componente pequeno |
| Mudanças cirúrgicas | ✅ `AppLayout` é o corpo antigo do `RootLayout`, sem alteração de lógica |
| Sem escopo extra | ✅ Nada de release, iOS ou variáveis no EAS (fora de escopo na spec) |
| Segue os padrões | ✅ Aviso com `Screen` + `EmptyState` (ícone `alerta`, sem ação), igual ao erro de migration; sem valor visual solto |
| Asserções batem com a spec | ✅ Título exato, splash, Google não configurado, erro do módulo nativo |
| Cobertura por camada | ✅ Os dois ramos do layout e o import/carregamento do módulo nativo |
| Todo teste mapeia um AC | ✅ Os 5 testes novos citam DEV-01..DEV-04 no nome |
| Guias do projeto | ✅ `AGENTS.md`, `.claude/CLAUDE.md` (sem `any`: `google()` tem retorno tipado `typeof GoogleSigninModulo`; o `eslint-disable` do `require` tem justificativa) |

---

## Edge Cases

- [x] Fonte falha ao carregar no Expo Go: `app/_layout.tsx:32` trata `erroDasFontes !== null` como pronto e mostra o aviso com a fonte do sistema. Não há teste para esse ramo (observação, não é AC).
- [x] Testes existentes que renderizam o layout raiz: o jest-expo simula o Expo Go; o mock global em `jest.setup.ts:33` devolve `false` e mantém essas suítes no fluxo do app de desenvolvimento.
- [x] `signInWithGoogle` e `signOut` continuam cobertos por `src/features/auth/__tests__/googleAuth.test.ts` (11 testes verdes), agora pelo `require` sob demanda.

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npx jest --selectProjects app`
- **Resultado**: typecheck exit 0; lint exit 0; Jest 117/117 suítes, 1425/1425 testes, 0 falhas, 0 pulados
- **Contagem antes da feature**: 1420 testes em 115 suítes (derivado: 1425 menos os 5 testes novos, em 2 suítes novas)
- **Contagem depois**: 1425
- **Delta**: +5 testes novos, nenhum removido nem enfraquecido

---

## Requirement Traceability Update

| Requirement | Status anterior | Novo status |
| --- | --- | --- |
| DEV-01 | Pending | ✅ Verified |
| DEV-02 | Pending | ✅ Verified |
| DEV-03 | Pending | ✅ Verified |
| DEV-04 | Pending | ✅ Verified |
| DEV-05 | Pending | ✅ Verified |
| DEV-06 | Pending | ✅ Verified |
| DEV-07 | Pending | ✅ Verified |
| DEV-08 | Pending | ✅ Verified |
| DEV-09 | Pending | ⏳ Manual, pendente (Jean) |

---

## Summary

**Overall**: ✅ Pronto (DEV-09 depende da checagem manual no celular)

**Checagem ancorada na spec**: 8/8 ACs automáticos/de leitura batem com a spec; 0 gaps de precisão; DEV-09 manual pendente
**Sensor**: 5/5 mutações mortas
**Gate**: 1425 testes verdes, typecheck e lint limpos

**O que funciona**: importar `googleAuth` não avalia mais o módulo nativo; no Expo Go o layout raiz mostra o aviso em português, esconde a splash e não configura o Google; fora dele o fluxo segue igual; `eas.json`, `projectId` e README cobrem o build de desenvolvimento.

**Pendente (manual)**: instalar o APK do EAS num celular real e entrar com Google, depois de registrar o SHA-1 do certificado do EAS num client OAuth Android (DEV-09).
