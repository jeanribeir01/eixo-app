# DESIGN_CYAN — Guia visual do Eixo App

Fonte única de verdade visual do app. Todo agente de IA e todo dev lê este arquivo **antes** de criar tela ou componente (ver `AGENTS.md` §0).

- Os valores abaixo já existem em `src/ui/tokens.ts`. **Telas nunca escrevem hex, número de spacing ou radius soltos** — usam os tokens, através dos primitivos de `src/ui/`.
- Se este guia e `src/ui/tokens.ts` divergirem, o código está errado ou o guia está desatualizado: avise o usuário, não escolha um lado sozinho.
- Base do guia: referência web "Seline" (`.claude/docs/DESIGN-CYAN.md`), adaptada para mobile. Componentes de marketing (depoimento, estrelas, mascote) não existem no app.

**Identidade em uma frase:** canvas stone quente, cartões brancos com borda hairline de 1px, **uma única família de azul da marca**, Inter, contenção deliberada.

> **Versão 2.0 — direção A · Contido (23/11/2026).** Evolução, não troca de identidade: a auditoria de UI
> mostrou que o app parecia MVP porque o guia 1.0 era contido demais e falhava em contraste (texto branco
> sobre o ciano do botão principal tinha 2,6:1). A 2.0 mantém stone + azul e acrescenta: um azul mais
> fundo para a ação primária, tons claros para seleção, peso 600 para números, cantos maiores, uma
> sombra para o cartão de destaque e ícones Phosphor. Protótipo de referência no Figma, arquivo
> "Eixo Certo — Redesign (DESIGN-CYAN 2.0)"; decisão em `.specs/STATE.md` AD-016 e ADR 0007.

---

## 1. Cores

| Token | Hex | Uso |
|---|---|---|
| `colors.canvas` | `#fafaf9` | Fundo de **toda** tela. Nunca `#ffffff` como fundo |
| `colors.surface` | `#ffffff` | Cartões, inputs, folha inferior, botão secundário |
| `colors.surfaceSunken` | `#f5f5f4` | Fundo de ícone em círculo, trilho de abas, superfície rebaixada |
| `colors.border` | `#e8e6e5` | Hairline de 1px — principal recurso estrutural |
| `colors.borderMuted` | `#d6d3d1` | Borda de campo e de botão secundário |
| `colors.textMuted` | `#a8a29e` | **Só** desabilitado e decoração (2,4:1 — não serve para texto que se lê) |
| `colors.textBody` | `#6b6560` | Corpo, labels secundários, ajuda de campo (5,5:1) |
| `colors.textPrimary` | `#0c0a09` | Títulos e ênfase |
| `colors.inverted` | `#1c1917` | Superfície invertida (uso raro: snackbar) |
| `colors.accentWash` | `#c1e1f7` | Fundo do highlight de título |
| `colors.accentSoft` | `#e6f3fd` | Fundo de chip/aba ativa, badge informativo, indicador da tab bar, avatar |
| `colors.accentText` | `#0b5a94` | Texto e ícone sobre `accentSoft`/`accentWash`; links (6,4:1) |
| `colors.accent` | `#3ba6f1` | A cor da marca: gráfico, rota no mapa, foco, spinner. **Nunca fundo de texto branco** |
| `colors.accentStrong` | `#1677c2` | Preenchimento da **ação primária** (botão e FAB): branco sobre ele dá 4,7:1 |
| `colors.accentEdge` | `#3398e1` | Traço da marca (logo) |
| `colors.onAccent` | `#ffffff` | Texto sobre `accentStrong` |
| `colors.success` / `successWash` | `#1a7f4f` / `#dcf5e6` | Entrada, estado bom |
| `colors.danger` / `dangerWash` | `#b42318` / `#fde8e6` | Saída, erro, ação grave |
| `colors.warning` / `warningWash` | `#b54708` / `#fef0c7` | "Pede atenção": vence em breve, aguardando aprovação, manutenção aberta |

### Regras de cor

- Neutros stone + **um** azul da marca, em quatro intensidades (`accentSoft` → `accent` → `accentStrong` → `accentText`). Não introduza outra cor de acento.
- **Um único elemento preenchido de azul (`accentStrong`) por tela** — a ação primária. Numa lista, essa ação é o FAB: com FAB na tela, nenhum `Button` primário aparece junto. Seleção (aba, chip, aba da tab bar) usa `accentSoft`, que não compete com ela.
- Sem gradiente, glassmorphism ou decoração com cor.
- **Gráficos:** entrada em `success` e saída em `danger`, como nos valores e no cartão do mês. Fatias de uma mesma natureza (a rosca de despesas) vão do azul ao stone (`accentStrong`, `accent`, `textBody`, `accentWash`, `borderMuted`; "Outras" em `textMuted`). Nunca preto num gráfico: ele lia como "saída".
- **Exceção semântica (financeiro e estado):** verde, vermelho e laranja aparecem só no **valor**, no ícone e no badge. Nunca no cartão, borda ou fundo inteiro. Nunca cor como único indicador: acompanhe sempre de sinal (`+` / `−`) ou rótulo — cor sozinha falha para daltônicos e sob sol forte na cabine.

### Contraste (WCAG 2.1 AA)

Texto precisa de 4,5:1; borda de controle e ícone que carrega sentido, de 3:1. Os pares abaixo foram medidos.

| Par | Contraste |
|---|---|
| `onAccent` sobre `accentStrong` (botão primário, FAB) | 4,7:1 |
| `accentText` sobre `accentSoft` (badge, aba ativa) | 6,4:1 |
| `textBody` sobre `canvas` | 5,5:1 |
| `warning` sobre `warningWash` | 4,8:1 |
| `success` sobre `surface` / `danger` sobre `surface` | 5,0:1 / 6,6:1 |
| `onAccent` sobre `accent` — **proibido** | 2,6:1 |

---

## 2. Tipografia

Fonte: **Inter** para o app todo (carregada com `expo-font`, ver `src/ui/fonts.ts`). Para títulos grandes, a família proprietária do guia (Roobert) é substituída por **Inter Tight** ou pelo próprio Inter com **tracking negativo**. Hoje o projeto usa Inter com tracking negativo (`letterSpacing` em `typography`).

| Variante | Tamanho | Line height | Tracking | Peso |
|---|---|---|---|---|
| `numeric` | 40 | 1.1 | −1.2 | 600 |
| `display` | 32 | 1.15 | −0.8 | 400 |
| `heading` | 24 | 1.25 | −0.5 | 400 |
| `subheading` | 20 | 1.2 | −0.1 | 400/500 |
| `title` | 17 | 1.3 | −0.2 | 600 |
| `body` | 15 | 1.55 | 0 | 400 |
| `bodySm` | 13 | 1.5 | 0 | 400 |
| `caption` | 12 | 1.35 | 0 | 400/500 |

- **Títulos de tela em peso 400.** Ênfase vem de tamanho e do highlight, não de negrito.
- Peso 500 (`weight="medium"`) para rótulo de botão, título de cartão e ênfase curta.
- Peso 600 (`weight="semibold"`) **só** para número em destaque (`numeric`: saldo, KPI) e título de seção (`title`: "Pede atenção"). Nunca 700.
- **Dois títulos, e só dois.** O da tela (`heading` 400, quando a tela não tem header nativo) e o de seção (`TituloSecao`: `title` 600). Grupo de lista ("Concluídas · 93"), bloco do Início ("Pede atenção"), seção de detalhe ("Histórico de manutenções"), de gráfico ("Entradas e saídas") e de formulário ("Origem") usam o mesmo. Título dentro de cartão (a placa, a descrição da dívida) não é título de seção.
- `caption` subiu de 11 para 12 na 2.0: 11 era pequeno demais na cabine.
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
| `radius.pill` | **9999** | Botões, badges, abas, chips |
| `radius.sheet` | 24 | Canto de cima da folha inferior (seletor, criação rápida, login) |
| `radius.feature` | 20 | Cartão de destaque (uma vez por tela) |
| `radius.card` | 14 | Cartões de conteúdo, grupos de linhas |
| `radius.input` | 10 | Campos de texto e seletor |
| `radius.icon` | 4 | Chip do highlight |

Na 2.0 os cantos cresceram (10→14, 16→20, 6→10): é o que mais aproxima o app de um produto atual sem mudar a identidade.

---

## 5. Bordas e sombras

- **A borda é a estrutura.** Cartão = fundo `surface` + borda 1px `colors.border` + `radius.card`. Sem sombra.
- Separador interno de cartão: hairline 1px `colors.border`, não divisor grosso.
- Sombra é exceção, não regra:

| Token | Valor | Onde |
|---|---|---|
| `shadow.subtle` | opacidade 5%, raio 2 | Botão do Google |
| `shadow.card` | opacidade 6%, deslocamento 4, raio 12 | **Um** cartão de destaque por tela (`Card variant="feature"`) |
| `shadow.float` | opacidade 14%, deslocamento 8, raio 20 | O que flutua sobre o conteúdo que rola: FAB e snackbar |

- Sombra em cartão de conteúdo comum é proibida: só o destaque e o que flutua. Em React Native, sombra exige `shadow*` (iOS) **e** `elevation` (Android) — os tokens já trazem os dois.
- Nada de `filter: grayscale()`: é CSS de web e não existe em React Native.

---

## 6. Alvo de toque

**Mínimo 44×44pt** (`touchTarget` em `tokens.ts`). O guia foi feito para mouse; o app é usado com o dedo, muitas vezes em movimento.

Vale para botão, linha de lista, `Switch` de soft delete, ícone de ação e aba. Se o visual for menor, aumente a área tocável (`minHeight`/`hitSlop`), não o visual.

Botão, FAB, campo e seletor usam `controlHeight` (**48pt**): acima do mínimo, para o dedo do motorista na cabine.

---

## 7. Componentes

### Botão primário (`Button variant="primary"`)
- Pílula (`radius.pill`), fundo e borda `accentStrong`, texto `onAccent` peso 500 (4,7:1).
- Padding `spacing.sm` × `spacing.lg`, `minHeight` `controlHeight` (48).
- **Uma vez por tela.** É a ação principal.

### Botão secundário (`Button variant="ghost"`)
- Pílula, fundo `surface`, borda 1px `borderMuted`, texto `textPrimary` peso 500.
- Ações secundárias e "Cancelar". Na 2.0 deixou de ser transparente, para não sumir sobre o canvas.

### Botão de perigo (`Button variant="danger"`)
- Pílula, fundo `dangerWash`, texto `danger` peso 500. Nunca vermelho cheio.
- Ação grave e reversível com cuidado: "Bloquear acesso", "Excluir". Vai no fim da tela, longe da ação primária, com uma linha explicando a consequência.

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
- **Destaque** (`variant="feature"`): `radius.feature`, mesma borda e fundo, mais a sombra `shadow.card`. É o cartão do topo (ex.: saldo no Início), **uma vez por tela**.
- **Tocável** (`onPress`): o cartão inteiro vira um botão (`accessibilityRole="button"`), com `accessibilityLabel` dizendo o destino ("Ver saldo e projeção"). Ao tocar: ripple `border` no Android, cortado nos cantos, e fundo `border` no iOS. Prefira o cartão tocável a um link pequeno escondido dentro dele.

### Ícone (`Icon`)
- **Phosphor** (`phosphor-react-native`, MIT) nas duas plataformas — o app tem a mesma cara no Android e no iOS (ADR 0007). A tela pede pelo **nome semântico** do mapa `src/ui/icons.ts` (`"financeiro"`, `"adicionar"`), nunca importa o ícone. Ícone novo entra no mapa primeiro, com import por ícone (`phosphor-react-native/src/icons/<Nome>`), nunca pelo índice do pacote.
- Peso pela prop `weight`: `regular` (contorno, o padrão), `fill` (cheio, estado ativo — aba selecionada), `duotone` (só em ilustração de estado vazio).
- Tamanhos `iconSize`: `sm` 16 (junto de texto pequeno), `md` 20 (linha de lista, aba), `lg` 24 (estado vazio).
- Cor pela prop `tone`, com os mesmos tons do `Text` (`primary`, `body`, `muted`, `accent`, `onAccent`, `success`, `danger`, `warning`). Nunca cor solta. O tom `accent` é `accentText`.
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
- Controle à direita que responde sozinho (o botão "Mais opções" de Movimentações) vai em `control`, **não** em `trailing`. Ele fica fora da área de toque da linha: tocar na linha abre o item, tocar no controle muda só ele, e o leitor de tela alcança os dois separados. Linha com `control` não mostra o chevron.
- Conteúdo que não cabe na linha padrão vai em `children` (modo livre).
- O subtítulo tem uma linha: ponha o que importa primeiro, para o corte cair no fim ("21/11 · Combustível · Cartão Corp…").
- **Trecho de rota:** `trecho()` de `src/lib/trecho.ts`, "Curitiba → São Paulo", sem UF. "Curitiba/PR" quebrava a linha depois da barra no Android. A UF (`ufsDoTrecho`: "PR → SP") vai no subtítulo, só onde separa duas rotas de mesmo nome (lista de Rotas, escolha da rota ao abrir a viagem).

### Título de seção (`TituloSecao`)
- `title` 17 peso 600 em `textPrimary`, com `accessibilityRole="header"`: o leitor de tela pula de seção em seção.
- `quantidade` opcional vira "Concluídas · 93". Nas listas, o título vai numa linha da `FlatList` com `paddingTop` `spacing.lg` e `paddingBottom` `spacing.xs`.
- Ninguém monta título de seção com `Text` solto.

### Grupo de linhas (`ListSection`)
- Rótulo opcional acima do grupo, desenhado pelo `TituloSecao`, com gap `spacing.sm`.
- Bloco `surface` com borda 1px `border` e `radius.card`. Separadores hairline **só entre** as linhas, e as linhas ganham padding lateral `spacing.base`.
- Use para menus e ajustes (hub Financeiro, Conta). Agrupa por borda e fundo: **não** faça um cartão por linha.

### Selo (`Badge`)
- Status de uma entidade tem **um** mapa de rótulo e **um** de tom, ao lado do tipo dela, e toda tela usa os dois: `rotuloStatusVeiculo`/`tomStatusVeiculo`, `rotuloStatusViagem`/`tomStatusViagem`, `rotuloPerfil`/`tomPerfil`. Nunca escreva o tom do selo na tela.
- Tom: `warning` para o que pede atenção (em manutenção, aguardando aprovação, em revisão), `neutral` para informação (na estrada, Administrador), `success` para o estado bom (disponível, concluída, ativo), `muted` para o que não tem ênfase (desativado, cancelada, os outros perfis), `danger` para o ruim (bloqueado).
- Rótulo com maiúscula só na primeira palavra ("Em manutenção", "Na estrada"). Uma palavra por status no app inteiro: a viagem em andamento é "Na estrada" na lista, no detalhe, no filtro e no Início.

### Grupo recolhido (`GrupoRecolhivel`)
- Cabeçalho tocável no mesmo estilo dos títulos de seção (`title` 600, "Desativadas · 2"), com o resumo dos nomes ao lado em `bodySm` `textBody` e a seta `avancar`/`recolher` na borda direita. `minHeight` `touchTarget`.
- Começa recolhido. Aberto, mostra as linhas e anuncia `expanded` ao leitor de tela.
- Uso: o fim das listas de cadastro, para o que foi desativado.

### Desativar e reativar (soft delete)
- **Um padrão só** em Categorias, Formas de pagamento, Rotas e Veículos. A lista mostra só os ativos; os desativados ficam no `GrupoRecolhivel` "Desativadas · N" (ou "Desativados") no fim. A linha não tem `Switch` nem "Mais opções": tocar abre o Editar.
- No fim do Editar, longe do "Salvar": `Button` danger "Desativar …" com a consequência numa linha embaixo; desativado, `Button` ghost "Reativar …" e um `Aviso` info no topo dizendo a situação. Sem diálogo de confirmação: o Snackbar de sucesso oferece "Desfazer".
- A palavra é sempre **desativar / desativada(o)**. "Inativo" fica só no banco.

### Campo de busca (`CampoBusca`)
- A mesma caixa do campo de texto (fundo, borda, raio, 48pt e anel de foco), com a lupa à esquerda e, quando há texto, o botão "×" ("Limpar busca") à direita.
- **Sem rótulo acima**: a lupa já diz que é busca, e o placeholder diz o que procurar ("Buscar por placa ou modelo"). É a única exceção ao "label sempre visível" do Input.
- Uma busca por lista, sempre no topo, na coluna da tela.

### Botão flutuante (`FAB`)
- Pílula `accentStrong`, ícone (padrão `adicionar`) e rótulo em `onAccent` peso 500. `minHeight` `controlHeight` (48), sombra `shadow.float`.
- **Sempre com rótulo** ("Nova categoria"): o rótulo é o nome anunciado pelo leitor de tela.
- Vai na prop `fab` do `Screen`, nunca solto no conteúdo. Com `scroll`, o `Screen` reserva `FAB_ALTURA_RESERVADA` no fim da rolagem, para a última linha não ficar atrás do botão.
- **O FAB conta como o único azul preenchido da tela**: tela com FAB não tem `Button` primário.
- Use na ação de criar de uma lista. Formulário não tem FAB: lá a ação é o `Button` primário "Salvar".

### Snackbar
- Fundo `inverted`, `radius.card`, padding `spacing.md` × `spacing.base`. Um ponto `spacing.xs` em `success` ou `danger` acompanha o texto em `onAccent` peso 500, porque cor nunca é o único indicador.
- **Posição:** sempre no `overlay` do `Screen`, ancorado no rodapé. Com FAB, fica acima dele, separado por `spacing.md`, nunca por cima.
- **Entrada:** fade e deslize de 8pt para cima em 200 ms. Com "remover animações" ligado no aparelho, só o fade. Some sozinho depois de `duration` (padrão 3 s).
- Anuncia com `accessibilityRole="alert"`. É o retorno obrigatório de toda ação: "Categoria salva.", "Não foi possível salvar."

### Folha de confirmação e de escolha (`FolhaDeConfirmacao`, `FolhaDeEscolha`)
- **Nunca o `Alert` nativo.** Os botões do sistema (verde-água, caixa alta no Android) ficam fora do guia. Toda pergunta antes de uma ação usa uma das duas folhas.
- Folha inferior em `surface`, com o canto `radius.sheet` em cima e o véu `inverted` translúcido, igual ao seletor (`Select`). Título em `subheading` peso 600, mensagem em `body` `textBody`, "Cancelar" ghost no fim. O voltar do Android e o toque no véu cancelam.
- **Confirmação:** o título pergunta pela ação ("Excluir movimentação?"), a mensagem diz o que acontece depois, e o botão diz a ação ("Excluir", "Finalizar"), nunca "Confirmar". `tom="danger"` quando apaga ou descarta algo.
- **Escolha:** caminhos equivalentes (Câmera ou Galeria, CSV ou PDF) viram linhas com ícone e descrição, sem seta e sem azul: nenhuma é a principal.

### Sem internet (`AvisoSemInternet`)
- Toda tela que depende do Supabase segue a mesma regra, aplicada pelo `useDadosDaTela`: **com dados na tela**, eles ficam, e o `AvisoSemInternet` aparece no topo do conteúdo ("Mostrando o que foi carregado às 14:32"); **sem dados**, o estado de erro diz "Sem internet" na hora, sem skeleton. Quando a conexão volta, a tela recarrega sozinha.
- Telas que leem só do banco local (Viagens, Detalhe da viagem, Início do Motorista) passam `precisaDeInternet: false`: carregam normalmente, e o `IndicadorSincronizacao` é quem fala da conexão.
- Formulário de edição e detalhe que carregam uma vez só usam o `useCargaUnica`, com a mesma regra. Ele não recarrega quando a conexão volta se a carga já deu certo, para não apagar o que a pessoa digitou.

### Estado vazio (`EmptyState`)
- Ícone `lg` em `textMuted` (opcional, decorativo) · título em `subheading` · descrição em `body` `textBody` · ação em `Button` ghost. Tudo centralizado, gap `spacing.md`, respiro vertical `spacing.xl`.
- Use o ícone do assunto da tela (`"categorias"` em Categorias). Também serve para erro de carga, com a ação "Tentar novamente".

### Campo de texto (Input)
- Fundo `surface`, `radius.input`, borda 1px `borderMuted`, padding `spacing.sm` × `spacing.md`, `minHeight` `controlHeight` (48).
- Placeholder `textBody`. Foco: anel 2px `accent`.
- **Erro:** borda `danger` + `MensagemErro` abaixo do campo — ícone `alerta` e texto `bodySm` em `danger`, em português, com `accessibilityRole="alert"`. Nunca só a borda. `Select` e `CampoData` usam a mesma `MensagemErro`.
- Label sempre visível acima do campo, em `bodySm` peso 500 `textPrimary`.

### Abas em pílula (Tab Pill Group)
- Ativa: fundo `accentSoft`, texto `accentText` peso 500, `radius.pill`. Inativa: fundo `surface`, texto `textPrimary`, borda 1px `border`.
- Rótulo numa linha só: a pílula nunca quebra a palavra no meio. Se os rótulos não cabem, use `scrollable`.
- Usada nas abas Entrada/Saída de Categorias e em filtros de período.

### Navegação
- Bottom tab bar. Não existe top nav em mobile.
- Tab bar: fundo `surface` com hairline `border` no topo, ícone `md` em cima e rótulo em `caption` peso 500 embaixo, inclusive no tablet.
- **Aba ativa** (`TabBarIcon`): ícone **cheio** em `accentText` sobre uma pílula `accentSoft` de `indicatorSize.tabWidth` × `tabHeight`, rótulo em `textPrimary`. Inativas: ícone em contorno e rótulo em `textBody`. Três sinais juntos (forma, fundo e cor), porque só a cor sumia ao sol. Nada de azul cheio no menu: o azul cheio da tela é a ação primária dela.
- Telas internas abrem por cima das abas, com o header nativo descrito em "Tela (`Screen`) e header nativo".
- A árvore de rotas depende do perfil (RBAC), não só a visibilidade dos botões.

### Logo
- Wordmark só na tela de Login e no header da Home. Avatar único no perfil; nada de cluster de avatares.
- **Marca:** duas rodas ligadas por um eixo, em `accentEdge`. Fonte única: `assets/brand/eixo-certo-mark.svg`.
- **No app:** `<Logo />` desenha a marca com 48pt (`spacing.xxl`); `<Logo withWordmark />` põe "Eixo Certo" em `subheading` abaixo dela, centralizado, com gap `spacing.sm`. No Login, a marca fica no topo e o login centralizado no espaço que sobra. O leitor de tela anuncia "Eixo Certo, imagem".
- **Ícone do app:** marca branca sobre `accentEdge`, a única superfície preenchida de azul fora da ação primária. **Splash:** marca em `accentEdge` sobre `canvas`, o mesmo fundo do Login.

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
- Botões em pílula, com 48pt de altura.
- Um azul preenchido (`accentStrong`) por tela: o `Button` primário ou, numa lista, o FAB.
- Seleção (aba, chip, aba da tab bar) em `accentSoft` + `accentText`.
- Montar telas **só** com primitivos de `src/ui/`. Se o primitivo não existe, crie-o antes da tela (com autorização, ver `AGENTS.md` §4).

**Não faça**
- Não invente cor, spacing, radius, peso ou tamanho de fonte fora dos tokens.
- Não use gradiente, glassmorphism ou sombra pesada em cartão de conteúdo.
- Não preencha botão primário com cor neutra/escura, nem com o `accent` claro (texto branco sobre ele dá 2,6:1).
- Não use `textMuted` em texto que precisa ser lido.
- Não empilhe vários highlights cyan no mesmo título.
- Não use largura fixa em pixels.
- Não crie um botão novo: estenda `Button` com variante e avise o usuário.

---

## 10. Checklist antes de entregar uma tela

- [ ] Nenhum hex, número de spacing/radius/fontSize hardcoded
- [ ] Fundo `canvas`; cartões `surface` com borda `border`
- [ ] No máximo um elemento azul preenchido (`accentStrong`)
- [ ] Texto com contraste ≥ 4,5:1 (ver a tabela de contraste em §1)
- [ ] Alvos de toque ≥ 44pt
- [ ] Carregando, vazio, erro e sucesso tratados
- [ ] Funciona em celular pequeno, grande e tablet
- [ ] Cor nunca é o único indicador (sinal ou rótulo junto)
