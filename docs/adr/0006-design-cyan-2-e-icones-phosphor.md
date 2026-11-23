# ADR 0006 — DESIGN-CYAN 2.0 e ícones Phosphor

- **Status:** Aceito
- **Data:** 2026-11-23
- **US:** redesign de UI antes da homologação (sem US própria; RNF02, RNF03)
- **Decisões relacionadas:** `.specs/STATE.md` AD-009, AD-016

## Contexto

A auditoria de UI de 23/11/2026 (153 prints dos 4 perfis) concluiu que o app parecia MVP. A causa não
era desvio de padrão no código: nenhuma tela usa hex, espaçamento ou raio soltos. Era o próprio guia
1.0. Três pontos pesaram:

1. **Contraste:** texto branco sobre o ciano do botão principal dava 2,6:1, e badges davam 2,3:1. O
   mínimo da WCAG AA é 4,5:1, e o motorista usa o app na cabine, sob sol.
2. **Hierarquia achatada:** tudo em peso 400 e cantos pequenos. Além disso, só a borda de 1,2:1
   separava os elementos.
3. **Ícones:** Material Symbols no Android e SF Symbols no iOS (`expo-symbols`). O app mudava de cara
   por plataforma, e no Android parecia o template padrão.

O usuário escolheu **evoluir** o DESIGN-CYAN, e não substituí-lo, na direção A · Contido do protótipo
no Figma ("Eixo Certo — Redesign (DESIGN-CYAN 2.0)"). Ele também deixou a biblioteca de ícones a
critério do agente, desde que fosse gratuita e combinasse com o app.

## Decisão

1. **Tokens 2.0** em `src/ui/tokens.ts`, com `DESIGN_CYAN.md` atualizado:
   - **Cores novas:**
     - `accentStrong` `#1677c2`: preenchimento da ação primária, branco sobre ele dá 4,7:1.
     - `accentSoft` `#e6f3fd` e `accentText` `#0b5a94`: seleção, badge e link.
     - `surfaceSunken`.
     - `warning`/`warningWash`: "pede atenção".
   - `textBody` vai para `#6b6560` (5,5:1). `textMuted` fica só para desabilitado.
   - **Tipografia:** peso 600 (`Inter_600SemiBold`), variantes `numeric` (40) e `title` (17), e
     `caption` de 11 para 12.
   - **Cantos maiores:** card 14, destaque 20, campo 10 e folha 24.
   - **Sombras:** `shadow.card`, só para o cartão de destaque, e `shadow.float` para FAB e snackbar.
   - **`controlHeight`:** 48 para botão, FAB, campo e seletor.
2. **Ícones Phosphor** (`phosphor-react-native` 3.x, licença MIT), nas duas plataformas. O mapa
   semântico `src/ui/icons.ts` continua sendo o único lugar que conhece o ícone.
   - **Import por ícone** (`phosphor-react-native/src/icons/<Nome>`), como o README do pacote
     recomenda. O Metro não descarta código que não é usado, e o índice levaria os ~1.500 ícones para
     o bundle.
   - **Pesos** pela prop `weight` do `Icon`: `regular` (padrão), `fill` (aba ativa) e `duotone`
     (estado vazio).
   - **Testes:** `jest.phosphor-stub.js` (via `moduleNameMapper`) troca cada ícone por um `Text` com
     testID `icone-<nome semântico>`, tamanho, cor e peso. Assim os testes não dependem da biblioteca.
3. **Primitivos ajustados:**
   - `Button`: primário em `accentStrong`, secundário em `surface` e variante nova `danger`.
   - `FAB`, `Card` (sombra no destaque), `Badge` (tons `neutral`, `muted`, `success`, `danger`,
     `warning`, com ponto), `Tabs` (ativa em `accentSoft`, rótulo numa linha só), `Switch`, `Avatar`.
   - `Input`/`Select`/`CampoData` com o primitivo novo `MensagemErro`: ícone e texto em `danger`.
   - `TabBarIcon` (novo): aba ativa com ícone cheio sobre uma pílula `accentSoft`.
   - Barra de status com ícones escuros no layout raiz.

## Consequências

- **Positivas:**
  - Todos os pares de texto passam de 4,5:1.
  - A mudança chega às 24 telas sem editar nenhuma delas.
  - Os ícones ficam iguais no Android e no iOS e têm o repertório de frota (`Truck`, `Path`,
    `GasPump`, `Gauge`, `Wrench`).
- **Negativas:**
  - O `expo-symbols` continua instalado sem uso, para não mexer no build nativo nesta fase. Pode sair
    num PR de limpeza.
  - O ícone passa a ser SVG desenhado em JS, e não mais uma fonte nativa. O custo é desprezível nos
    tamanhos usados (16–24pt).
- **Fora deste ADR:** a recomposição das telas (Início com cartão vivo, Usuários com aprovação no
  topo, Categorias com abas e "desfazer", login com foto) fica para os PRs de tela, que seguem o
  protótipo.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `phosphor-react-native` ^3.0.6 | Ícones MIT iguais nas duas plataformas, com 6 pesos. Depende só de `react-native-svg`, que já estava instalado |
