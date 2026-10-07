# ADR 0003 — Anexo de comprovante: caminho no bucket privado e imagem comprimida no aparelho

- **Status:** Aceito
- **Data:** 2026-10-07
- **US:** EIX-34 (US03-b)

## Contexto

A US03-b anexa uma foto do comprovante à movimentação. O bucket `comprovantes` já existe desde a
EIX-27 (`20260924000600_storage_comprovantes.sql`). Ele é **privado**, e as policies de
`storage.objects` liberam o acesso só para Admin e Financeiro. Duas perguntas ficaram para esta
entrega: o que a movimentação guarda para achar o arquivo, e como o app reduz a foto antes de subir.
O critério de aceite pede no máximo ~1 MB, para não gastar o pacote de dados do motorista.

## Decisão

1. **A movimentação guarda o caminho, não a URL.** A coluna nova é `movimentacao.caminho_comprovante`
   (`20261007000100_anexo_comprovante.sql`). Para mostrar a imagem, o app pede uma signed URL de 60
   segundos (`src/lib/storage.ts`). URL pública não serve, porque o bucket é privado. Guardar uma
   signed URL também não, porque ela expira.
2. **O bucket e as policies não mudam.** A migration da US03-b só cria a coluna. Abrir o bucket ou
   acrescentar policies sem `TO` daria leitura a qualquer pessoa, inclusive `anon`, porque policies
   permissivas se somam com OR.
3. **A foto é reduzida no aparelho, antes do upload.** Se tiver mais de 1600 px de largura, ela
   desce para 1600 px e é salva em JPEG com qualidade 0,6. Nessa resolução, o texto do comprovante
   continua legível e o arquivo fica bem abaixo de 1 MB.
4. **O arquivo é lido como bytes pela API nova do `expo-file-system`** (`new File(uri).arrayBuffer()`).
   Desde o SDK 54, o `readAsStringAsync` importado de `expo-file-system` lança erro em tempo de
   execução. Com a API nova também não é preciso converter de base64.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `expo-image-picker` | Câmera e galeria, com permissão pedida na hora do uso. Já previsto na stack (CLAUDE.md §2) |
| `expo-image-manipulator` | Reduz e comprime a foto no aparelho. O picker só ajusta a qualidade e não redimensiona |
| `expo-file-system` | Lê o arquivo comprimido como bytes para o upload. Já vinha como dependência do `expo`; agora é declarado |

Todos são módulos nativos do Expo SDK 57. **O development build precisa ser gerado de novo**
(`eas build --profile development`), senão o app não encontra o módulo nativo.

## Alternativas consideradas

- **Só o `quality` do `expo-image-picker`:** sem redimensionar, uma foto de 12 MP fica acima de
  1 MB mesmo com qualidade baixa. Rejeitada por não cumprir o critério de aceite.
- **`base64-arraybuffer` + `readAsStringAsync` do `expo-file-system/legacy`:** funciona, mas traz
  uma dependência a mais e usa uma API marcada como legada. Rejeitada.
- **Bucket público com `getPublicUrl`:** mais simples de exibir, mas qualquer pessoa com o link veria
  o comprovante, e o Motorista não deve ver nada financeiro (US18). Rejeitada.

## Consequências

- Se a pessoa anexa uma foto e sai sem salvar, o arquivo fica no bucket sem nenhuma movimentação
  apontando para ele. Anexo trocado ou removido antes de salvar é apagado na hora. Já o anexo
  gravado só é apagado depois que a movimentação for salva sem ele.
- Quem tiver uma signed URL consegue abrir o arquivo até ela expirar (60 s).
- A miniatura faz uma chamada ao Storage a cada abertura do formulário, porque a URL não fica
  guardada.

## Links

- `src/lib/storage.ts`, `src/features/movimentacoes/components/AnexoComprovante.tsx`
- `supabase/migrations/20260924000600_storage_comprovantes.sql` (bucket e policies)
- Segue o formato de [`docs/adr/0002-schema-base-rls-e-testes-pglite.md`](./0002-schema-base-rls-e-testes-pglite.md)
