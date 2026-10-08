# DESIGN_CYAN — Guia visual do Eixo App

Fonte única de verdade visual do app. Todo agente de IA e todo dev lê este arquivo **antes** de criar tela ou componente (ver `AGENTS.md` §0).

- Os valores abaixo já existem em `src/ui/tokens.ts`. **Telas nunca escrevem hex, número de spacing ou radius soltos** — usam os tokens, através dos primitivos de `src/ui/`.
- Se este guia e `src/ui/tokens.ts` divergirem, o código está errado ou o guia está desatualizado: avise o usuário, não escolha um lado sozinho.
- Base do guia: referência web "Seline" (`.claude/docs/DESIGN-CYAN.md`), adaptada para mobile. Componentes de marketing (depoimento, estrelas, mascote) não existem no app.

**Identidade em uma frase:** canvas stone quente, cartões brancos com borda hairline de 1px, **um único acento cyan**, Inter, contenção deliberada.

---

## 1. Cores

| Token | Hex | Uso |
|---|---|---|
| `colors.canvas` | `#fafaf9` | Fundo de **toda** tela. Nunca `#ffffff` como fundo |
| `colors.surface` | `#ffffff` | Cartões, inputs, superfícies elevadas |
| `colors.border` | `#e8e6e5` | Hairline de 1px — principal recurso estrutural |
| `colors.borderMuted` | `#d6d3d1` | Borda de input, separadores secundários |
| `colors.textMuted` | `#a8a29e` | Helper text, ícones e estados desabilitados |
| `colors.textBody` | `#78716c` | Corpo de texto, labels secundários |
| `colors.textPrimary` | `#0c0a09` | Títulos e ênfase |
| `colors.inverted` | `#1c1917` | Superfície invertida (uso raro; aba ativa) |
| `colors.accentWash` | `#c1e1f7` | Fundo do highlight de título |
| `colors.accent` | `#3ba6f1` | **CTA primária** e ícones — único acento cromático |
| `colors.accentEdge` | `#3398e1` | Borda do botão primário, links, texto do highlight. Nunca vira preenchimento de CTA |
| `colors.onAccent` | `#ffffff` | Texto sobre o botão cyan |

### Regras de cor

- Neutros stone + **um** cyan. Não introduza outra cor de acento.
- **Um único elemento preenchido de cyan por tela** — a ação primária. Numa lista, essa ação é o FAB: com FAB na tela, nenhum `Button` primário aparece junto.
- Sem gradiente, glassmorphism ou decoração com cor.
- **Exceção semântica (financeiro):** verde/vermelho discretos aparecem só no **valor** e no ícone de entrada/saída. Nunca no cartão, borda ou fundo inteiro. Nunca cor como único indicador: acompanhe sempre de sinal (`+` / `−`) ou rótulo — cor sozinha falha para daltônicos e sob sol forte na cabine.

---

## 2. Tipografia

Fonte: **Inter** para o app todo (carregada com `expo-font`, ver `src/ui/fonts.ts`). Para títulos grandes, a família proprietária do guia (Roobert) é substituída por **Inter Tight** ou pelo próprio Inter com **tracking negativo**. Hoje o projeto usa Inter com tracking negativo (`letterSpacing` em `typography`).

| Variante | Tamanho | Line height | Tracking | Peso |
|---|---|---|---|---|
| `display` | 32 | 1.15 | −0.8 | 400 |
| `heading` | 24 | 1.25 | −0.5 | 400 |
| `subheading` | 20 | 1.2 | −0.1 | 400/500 |
| `body` | 15 | 1.55 | 0 | 400 |
| `bodySm` | 13 | 1.5 | 0 | 400 |
| `caption` | 11 | 1.4 | 0 | 400 |

- **Títulos em peso 400.** Ênfase vem de tamanho e do highlight, não de negrito.
- Peso 500 (`weight="medium"`) só para rótulo de botão e ênfase curta. Nunca 700.
- Sempre use o primitivo `Text` (`variant`, `tone`, `weight`). Nunca `fontSize`/`fontFamily` soltos.

### Highlight de título

Uma frase por título recebe texto `accentEdge` sobre fundo `accentWash` (pill, radius 4, padding ~2×8). Em React Native é um `View` com fundo envolvendo o `Text`, não um `<span>`.

- No máximo **um** por título; nunca em corpo de texto, lista ou item de navegação.
- Só em título de dashboard, no KPI principal.

---

## 3. Espaçamento

Unidade base: **4pt**. Densidade compacta.

| Token | Valor | Uso típico |
|---|---|---|
| `spacing.xs` | 4 | Ícone ↔ texto, ajuste fino |
| `spacing.sm` | 8 | Gap entre elementos relacionados; padding vertical de botão |
| `spacing.md` | 12 | Gap dentro de cartão |
| `spacing.base` | 16 | **Padding lateral da tela**; padding horizontal de botão |
| `spacing.lg` | 24 | Padding de cartão; gap entre seções |
| `spacing.xl` | 32 | Respiro entre blocos grandes |
| `spacing.xxl` | 48 | Topo de tela de destaque (Login) |

Adaptações do guia web para mobile:

- Section gap de 96px → **24/32pt**. A contenção vem do espaço dentro do cartão, não entre seções.
- Page max-width de 1200px → **irrelevante**. Padding lateral `spacing.base` e conteúdo fluido (RNF02).
- Nunca largura fixa em pixels: o layout tem que funcionar em celular pequeno, grande e tablet (`useWindowDimensions` quando precisar de breakpoint).

---

## 4. Radius

| Token | Valor | Elemento |
|---|---|---|
| `radius.pill` | **9999** | Botões, tags, abas |
| `radius.card` | 10 | Cartões de conteúdo |
| `radius.feature` | 16 | Cartão de destaque (uma vez por tela) |
| `radius.input` | 6 | Campos de texto |
| `radius.icon` | 4 | Ícones, chip do highlight |

---

## 5. Bordas e sombras

- **A borda é a estrutura.** Cartão = fundo `surface` + borda 1px `colors.border` + `radius.card`. Sem sombra.
- Separador interno de cartão: hairline 1px `colors.border`, não divisor grosso.
- Sombra é exceção, não regra:

| Nome | Valor (referência web) | Onde |
|---|---|---|
| subtle | `rgba(0,0,0,0.05) 0 1px 2px` | Hairline de botão/nav (opcional) |
| md | `rgba(0,0,0,0.05) 0 4px 16px` | Só se um cartão precisar de leve elevação |
| xl | `rgba(17,12,46,0.12) 0 12px 45px` | **Um** cartão de destaque por tela (o "Floating Dashboard Preview") |

- Sombra pesada em cartão de conteúdo é proibida. Em React Native, sombra exige `shadow*` (iOS) **e** `elevation` (Android) — se precisar, crie o token em `src/ui/tokens.ts` (peça autorização, é área compartilhada).
- Nada de `filter: grayscale()`: é CSS de web e não existe em React Native.

---

## 6. Alvo de toque

**Mínimo 44×44pt** (`touchTarget` em `tokens.ts`). O guia foi feito para mouse; o app é usado com o dedo, muitas vezes em movimento.

Vale para botão, linha de lista, `Switch` de soft delete, ícone de ação e aba. Se o visual for menor, aumente a área tocável (`minHeight`/`hitSlop`), não o visual.

---

## 7. Componentes

### Botão primário (`Button variant="primary"`)
- Pílula (`radius.pill`), fundo `accent`, borda 1px `accentEdge`, texto `onAccent` peso 500.
- Padding `spacing.sm` × `spacing.base`, `minHeight` 44.
- **Uma vez por tela.** É a ação principal.

### Botão ghost (`Button variant="ghost"`)
- Pílula, fundo transparente, borda 1px `border`, texto `textPrimary` peso 400.
- Ações secundárias e "Cancelar".

### Botão de ícone (`Button variant="icon" icon="..."`)
- Só o ícone (`md`, `textBody`), sem borda nem fundo, com alvo de 44×44.
- O `label` não aparece: é o nome que o leitor de tela anuncia ("Mês anterior", "Mais opções: Diesel"). Sempre diga a ação e, numa lista, de qual linha.
- Ações secundárias que todo mundo reconhece pelo ícone: trocar de mês, "Mais opções" de uma linha.

### Estados de botão

| Estado | Visual | Comportamento |
|---|---|---|
| Normal | Como acima | — |
| Pressionado | `opacity: 0.6` | Feedback imediato ao toque |
| Loading | Spinner à esquerda do rótulo + `opacity: 0.6` | **Desabilitado e `busy`**: ignora toques (evita duplo envio) |
| Desabilitado | `opacity: 0.6` | `accessibilityState.disabled`; sem `onPress` |
| Foco (teclado/acessibilidade) | Anel de 2px `accent` | Em campos de texto; ver Input |

Todo botão tem `accessibilityRole="button"` e `accessibilityLabel`. Toda ação do usuário devolve feedback: **loading no botão + mensagem de sucesso ou de erro** (AGENTS.md §2.1).

### Cartão (`Card`) — o componente mais usado
- Fundo `surface`, borda 1px `border`, `radius.card`, padding `spacing.lg`, gap interno `spacing.md`.
- Use para saldo, veículo, viagem, lançamento.
- **Destaque** (`variant="feature"`): `radius.feature`, mesma borda e mesmo fundo. É o cartão do topo (ex.: saldo no hub Financeiro), **uma vez por tela**.
- **Tocável** (`onPress`): o cartão inteiro vira um botão (`accessibilityRole="button"`), com `accessibilityLabel` dizendo o destino ("Ver saldo e projeção"). Ao tocar: ripple `border` no Android, cortado nos cantos, e fundo `border` no iOS. Prefira o cartão tocável a um link pequeno escondido dentro dele.

### Ícone (`Icon`)
- Material Symbols no Android e SF Symbols no iOS (`expo-symbols`). A tela pede pelo **nome semântico** do mapa `src/ui/icons.ts` (`"financeiro"`, `"adicionar"`), nunca pelo nome do símbolo. Ícone novo entra no mapa primeiro.
- Tamanhos `iconSize`: `sm` 16 (junto de texto pequeno), `md` 20 (linha de lista, aba), `lg` 24 (estado vazio).
- Cor pela prop `tone`, com os mesmos tons do `Text` (`primary`, `body`, `muted`, `onAccent`…). Nunca cor solta.
- **Sem `accessibilityLabel` o ícone é decorativo** e o leitor de tela o ignora, porque o texto ao lado já diz o que é. Com rótulo, vira imagem anunciada: use quando o ícone aparece sozinho.

### Tela (`Screen`) e header nativo
- Toda tela começa com `Screen`: fundo `canvas`, padding lateral `spacing.base`, área segura.
- **Telas internas** (abertas por cima das abas) usam o header nativo: fundo `canvas`, sem sombra, título em `subheading` peso 400 `textPrimary`, voltar só com a seta. O título de cada tela é declarado em `app/(app)/_layout.tsx`, junto do guard de perfil. **A tela nunca repete o título no conteúdo** e usa `<Screen underHeader>`, para não somar o inset de topo duas vezes.
- `scroll`: o conteúdo rola e sobe com o teclado. Use em formulário e detalhe.
- `overlay`: camada que flutua sobre o conteúdo e não rola com ele, ancorada no rodapé com respiro `spacing.base`. É onde mora o `Snackbar`. Fora dos elementos dela, a tela continua respondendo ao toque.
- `fab`: o botão flutuante da tela (ver FAB). Fica no rodapé, à direita, sempre abaixo do Snackbar.

### Linha de lista (`ListItem`)
- **Anatomia:** ícone `md` em `textBody` (opcional) · título em `body` · subtítulo em `bodySm` `textBody`, uma linha com reticências (opcional) · à direita, o `trailing` (valor, `Badge`) ou, se a linha abre algo, o chevron `avancar` em `textMuted`.
- `minHeight` 44, padding vertical `spacing.md`, gap `spacing.md`. Solta na tela, a linha separa-se da próxima com hairline `border` embaixo.
- Ao tocar: ripple `border` no Android e fundo `border` no iOS. A linha não usa o `opacity 0.6` dos botões.
- O `accessibilityLabel` padrão é o título. Passe outro quando o título sozinho não basta ("Gerenciar Bruno Lima").
- Controle à direita que responde sozinho (o `Switch` "Ativa", o botão "Mais opções") vai em `control`, **não** em `trailing`. Ele fica fora da área de toque da linha: tocar na linha abre o item, tocar no controle muda só ele, e o leitor de tela alcança os dois separados. Linha com `control` não mostra o chevron.
- Conteúdo que não cabe na linha padrão vai em `children` (modo livre).

### Grupo de linhas (`ListSection`)
- Rótulo opcional em `caption` peso 500 `textBody` acima do grupo, com gap `spacing.sm`.
- Bloco `surface` com borda 1px `border` e `radius.card`. Separadores hairline **só entre** as linhas, e as linhas ganham padding lateral `spacing.base`.
- Use para menus e ajustes (hub Financeiro, Conta). Agrupa por borda e fundo: **não** faça um cartão por linha.

### Botão flutuante (`FAB`)
- Pílula `accent` com borda 1px `accentEdge`, ícone (padrão `adicionar`) e rótulo em `onAccent` peso 500. `minHeight` 44, padding `spacing.sm` × `spacing.base`, sombra `subtle`, a única do app fora do botão do Google.
- **Sempre com rótulo** ("Nova categoria"): o rótulo é o nome anunciado pelo leitor de tela.
- Vai na prop `fab` do `Screen`, nunca solto no conteúdo. Com `scroll`, o `Screen` reserva `FAB_ALTURA_RESERVADA` no fim da rolagem, para a última linha não ficar atrás do botão.
- **O FAB conta como o único cyan preenchido da tela**: tela com FAB não tem `Button` primário.
- Use na ação de criar de uma lista. Formulário não tem FAB: lá a ação é o `Button` primário "Salvar".

### Snackbar
- Fundo `inverted`, `radius.card`, padding `spacing.md` × `spacing.base`. Um ponto `spacing.xs` em `success` ou `danger` acompanha o texto em `onAccent` peso 500, porque cor nunca é o único indicador.
- **Posição:** sempre no `overlay` do `Screen`, ancorado no rodapé. Com FAB, fica acima dele, separado por `spacing.md`, nunca por cima.
- **Entrada:** fade e deslize de 8pt para cima em 200 ms. Com "remover animações" ligado no aparelho, só o fade. Some sozinho depois de `duration` (padrão 3 s).
- Anuncia com `accessibilityRole="alert"`. É o retorno obrigatório de toda ação: "Categoria salva.", "Não foi possível salvar."

### Estado vazio (`EmptyState`)
- Ícone `lg` em `textMuted` (opcional, decorativo) · título em `subheading` · descrição em `body` `textBody` · ação em `Button` ghost. Tudo centralizado, gap `spacing.md`, respiro vertical `spacing.xl`.
- Use o ícone do assunto da tela (`"categorias"` em Categorias). Também serve para erro de carga, com a ação "Tentar novamente".

### Campo de texto (Input)
- Fundo `surface`, `radius.input`, borda 1px `borderMuted`, padding vertical 4 / horizontal `spacing.md`, `minHeight` 44.
- Placeholder `textBody`. Foco: anel 2px `accent`. Erro: mensagem abaixo do campo em `bodySm`, em português, com `accessibilityRole="alert"` — nunca só borda vermelha.
- Label sempre visível acima do campo.

### Abas em pílula (Tab Pill Group)
- Ativa: fundo `inverted`, texto branco, `radius.pill`. Inativa: transparente, texto `textPrimary`, borda 1px `border`.
- Usada nas abas Entrada/Saída de Categorias e em filtros de período.

### Navegação
- Bottom tab bar. Não existe top nav em mobile.
- Tab bar: fundo `surface` com hairline `border` no topo, ícone `md` em cima e rótulo em `caption` peso 500 embaixo, inclusive no tablet. Aba ativa em `textPrimary`, inativas em `textBody`. **Sem cyan no menu**: o cyan da tela é a ação primária dela.
- Telas internas abrem por cima das abas, com o header nativo descrito em "Tela (`Screen`) e header nativo".
- A árvore de rotas depende do perfil (RBAC), não só a visibilidade dos botões.

### Logo
- Wordmark só na tela de Login e no header da Home. Avatar único no perfil; nada de cluster de avatares.

---

## 8. Estados obrigatórios em toda tela de dados

| Estado | O que mostrar |
|---|---|
| Carregando | Indicador ou skeleton neutro; nunca tela em branco |
| Vazio | Mensagem curta + ação para criar o primeiro item. A personalidade da marca vem daqui, não de mascote |
| Erro | Mensagem em português + botão "Tentar novamente" |
| Sucesso | Feedback visual da ação concluída (Snackbar) |

---

## 9. Faça / Não faça

**Faça**
- Fundo `canvas`, cartões `surface`. Nunca o inverso.
- Borda hairline como separador estrutural.
- Botões em pílula, padding 8/16.
- Um cyan preenchido por tela: o `Button` primário ou, numa lista, o FAB.
- Montar telas **só** com primitivos de `src/ui/`. Se o primitivo não existe, crie-o antes da tela (com autorização, ver `AGENTS.md` §4).

**Não faça**
- Não invente cor, spacing, radius, peso ou tamanho de fonte fora dos tokens.
- Não use gradiente, glassmorphism ou sombra pesada em cartão de conteúdo.
- Não preencha botão primário com cor neutra/escura.
- Não empilhe vários highlights cyan no mesmo título.
- Não use largura fixa em pixels.
- Não crie um botão novo: estenda `Button` com variante e avise o usuário.

---

## 10. Checklist antes de entregar uma tela

- [ ] Nenhum hex, número de spacing/radius/fontSize hardcoded
- [ ] Fundo `canvas`; cartões `surface` com borda `border`
- [ ] No máximo um elemento cyan preenchido
- [ ] Alvos de toque ≥ 44pt
- [ ] Carregando, vazio, erro e sucesso tratados
- [ ] Funciona em celular pequeno, grande e tablet
- [ ] Cor nunca é o único indicador (sinal ou rótulo junto)
