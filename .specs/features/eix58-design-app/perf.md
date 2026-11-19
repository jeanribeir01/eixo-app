# Performance medida — EIX-71 (PRF-01)

Otimização com número: mede antes, mexe e mede depois, **no mesmo celular** e com os **mesmos dados**.

## O que é medido e onde

| Métrica | Build | Ferramenta | Por quê |
| --- | --- | --- | --- |
| Cold start | APK de release (perfil `preview`) | `adb shell am start -W` → `TotalTime` | O dev build carrega o JS pelo Metro e é várias vezes mais lento: o número não valeria nada |
| fps do JS na rolagem | App de desenvolvimento rodando o **bundle de produção** (`--no-dev --minify`) | Perf Monitor do menu de desenvolvimento | O Perf Monitor só existe no menu de desenvolvimento, e esse menu não vai no APK de release. Com `--no-dev --minify` o JS é o mesmo do release, sem os avisos e checagens do modo dev |
| Frames lentos na rolagem | APK de release | `adb shell dumpsys gfxinfo` | Complementa o fps do JS com a thread de UI no build real |

> **Divergência do critério de aceite, decidida com o usuário em 19/11:** o critério pedia fps do JS
> "no monitor de performance" e "no APK de release" ao mesmo tempo, o que não existe junto. O fps do
> JS sai do bundle de produção no app de desenvolvimento; o cold start e o `gfxinfo` saem do APK de
> release.

`TotalTime` mede do toque até o **primeiro frame** do Android (a splash). O tempo até a tela inicial
ficar interativa é maior; ele entra na coluna "até a Home" cronometrada no vídeo (passo 3, opcional).

## Preparação (uma vez)

1. **Dados:** no SQL Editor do Supabase, rode `supabase/seed/perf-200.sql` (modo `'criar'`). Ele cria
   200 movimentações "Perf 001…200" no mês atual. O banco é compartilhado (AD-003): avise o grupo e,
   ao terminar o "depois", rode de novo com `modo := 'remover'`.
2. **Celular:** cabo USB, depuração USB ligada, `adb devices` mostrando o aparelho. Bateria acima de
   50%, sem economia de energia, Wi-Fi na mesma rede de sempre.
3. **Gesto de rolagem padronizado.** Calcule as coordenadas a partir da tela:

   ```powershell
   adb shell wm size   # ex.: Physical size: 1080x2400
   ```

   Use `x = largura / 2`, de `y1 = 80% da altura` até `y2 = 25% da altura`, em 120 ms. Com 1080x2400:

   ```powershell
   # 10 flings para baixo e 10 para cima, sempre iguais
   1..10 | % { adb shell input swipe 540 1920 540 600 120; Start-Sleep -Milliseconds 600 }
   1..10 | % { adb shell input swipe 540 600 540 1920 120; Start-Sleep -Milliseconds 600 }
   ```

## Passo a passo

### Antes (commit da `main` sem as mudanças da EIX-71)

O "antes" é o commit `91c20ac` (só o seed e este arquivo, nenhuma mudança no app). O EAS envia a
pasta do jeito que ela está, então faça o checkout antes de gerar o build:

```powershell
git checkout 91c20ac
```

**A. APK de release:** `npx eas-cli@latest build --profile preview --platform android` e instale
(README → APK de release). Entre como Admin.

1. Cold start, 5 vezes, anote a mediana:

   ```powershell
   adb shell am force-stop com.eixocerto.app
   adb shell am start -W -n com.eixocerto.app/.MainActivity   # anote TotalTime
   ```

2. Rolagem no release: abra Caixa → Movimentações (mês atual, 200 linhas, aguarde carregar), então:

   ```powershell
   adb shell dumpsys gfxinfo com.eixocerto.app reset
   # rode os 20 swipes da preparação
   adb shell dumpsys gfxinfo com.eixocerto.app | Select-String "Total frames|Janky frames|90th|95th|99th"
   ```

3. (Opcional) Até a Home: `adb shell screenrecord /sdcard/cold.mp4`, toque no ícone, pare com Ctrl+C
   quando a Home mostrar os dados, `adb pull /sdcard/cold.mp4` e conte o tempo no player.

**B. fps do JS:** reinstale o app de desenvolvimento (ele substitui o release) e rode o bundle de produção:

```powershell
npx expo start --dev-client --no-dev --minify
```

Abra o menu de desenvolvimento (`adb shell input keyevent 82`) → **Toggle performance monitor**. Abra
Movimentações, rode os 20 swipes e anote o **menor fps do JS** e o valor em que ele fica a maior
parte do tempo. Repita 3 vezes.

### Depois (branch com as linhas memoizadas)

Mesmos passos, na ordem inversa para reinstalar menos: primeiro o **B** (o app de desenvolvimento já
está instalado; basta `git checkout perf/eix-71-listas-cold-start` e o mesmo `npx expo start`), depois
o **A** com um APK de release novo gerado da branch.

## Aparelho

| Campo | Valor |
| --- | --- |
| Modelo | |
| Android | |
| RAM | |
| Resolução (`wm size`) | |
| Data da medição | |

## Linha de base (antes)

Commit medido: `91c20ac`

| Métrica | Medição 1 | 2 | 3 | 4 | 5 | Mediana |
| --- | --- | --- | --- | --- | --- | --- |
| Cold start `TotalTime` (ms) | | | | | | |
| Até a Home (s, opcional) | | | | | | |

| Rolagem — 200 movimentações | Rodada 1 | 2 | 3 |
| --- | --- | --- | --- |
| fps do JS, mínimo | | | |
| fps do JS, típico | | | |
| `gfxinfo` frames lentos (%) | | | |
| `gfxinfo` 90º percentil (ms) | | | |

## Depois

Commit medido: `5af7e1c` (linhas memoizadas em Movimentações, Categorias, Formas e Usuários)

| Métrica | Medição 1 | 2 | 3 | 4 | 5 | Mediana |
| --- | --- | --- | --- | --- | --- | --- |
| Cold start `TotalTime` (ms) | | | | | | |
| Até a Home (s, opcional) | | | | | | |

| Rolagem — 200 movimentações | Rodada 1 | 2 | 3 |
| --- | --- | --- | --- |
| fps do JS, mínimo | | | |
| fps do JS, típico | | | |
| `gfxinfo` frames lentos (%) | | | |
| `gfxinfo` 90º percentil (ms) | | | |

## Diferença

| Métrica | Antes | Depois | Diferença |
| --- | --- | --- | --- |
| Cold start mediana (ms) | | | |
| fps do JS típico | | | |
| fps do JS mínimo | | | |
| `gfxinfo` frames lentos (%) | | | |

Meta do critério de aceite: fps do JS **≥ 55** na rolagem. Se o `FlatList` memoizado não chegar lá,
a próxima opção é FlashList/LegendList, que é dependência nova e precisa de ADR (CLAUDE.md §12).
