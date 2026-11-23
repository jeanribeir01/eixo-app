# ADR 0006 — Exportação de relatórios com expo-print e expo-sharing

- **Status:** Aceito
- **Data:** 2026-11-23
- **US:** EIX-47 (US14)
- **Decisões relacionadas:** `.specs/features/eix47-exportacao/spec.md` (premissas); `.specs/STATE.md` AD-003 (só Android nesta fase)

## Contexto

A US14 pede que o gestor exporte as transações do período em CSV ou PDF e mande o arquivo pela API
nativa de compartilhamento do Android/iOS, não por download no navegador. O projeto já grava arquivos
com `expo-file-system` (comprovantes, ADR 0003), mas não tem como gerar um PDF nem abrir o Share Sheet
do sistema com um arquivo.

O `Share` do React Native compartilha texto e, no iOS, uma URL. No Android ele não anexa arquivo, então
não serve para entregar um `.csv` ou `.pdf` ao WhatsApp, ao e-mail ou ao Drive.

## Decisão

1. **`expo-print` gera o PDF a partir de HTML** (`printToFileAsync`). O HTML é montado por uma função
   pura em `src/features/relatorios/export/pdf.ts`, testável no Jest sem o módulo nativo. A página é
   A4 e o cabeçalho da tabela se repete em toda página (`thead { display: table-header-group }`).
2. **`expo-sharing` abre o Share Sheet** (`shareAsync`) com o arquivo e o mime type (`text/csv` ou
   `application/pdf`).
3. **O CSV é texto gravado com `expo-file-system`**, já instalado: BOM UTF-8, `;` e CRLF, o formato
   que o Excel em português abre direto.
4. Versões do Expo SDK 57 (`expo/bundledNativeModules.json`): `expo-print ~57.0.2` e
   `expo-sharing ~57.0.19`. O lockfile foi gerado com npm 10, o mesmo do CI.

## Dependências introduzidas

| Pacote | Por quê |
|---|---|
| `expo-print` | Gerar o PDF do relatório a partir de HTML, no próprio aparelho |
| `expo-sharing` | Entregar o arquivo pelo Share Sheet do sistema (AC da US14) |

Os dois são módulos nativos. **O development build precisa ser gerado de novo**
(`eas build --profile development`), senão o app não encontra o módulo nativo ao exportar.

## Alternativas consideradas

- **`Share` do React Native:** não anexa arquivo no Android. Rejeitada.
- **Biblioteca de PDF em JavaScript (pdf-lib, jsPDF):** desenha o PDF coordenada por coordenada, com
  quebra de página manual e fonte embutida para acento. Mais código para o time manter. Rejeitada.
- **Gerar o arquivo numa Edge Function:** exigiria função nova, deploy e storage para um arquivo que
  o aparelho já sabe montar, e não funcionaria sem a função no ar. Rejeitada.

## Consequências

- O PDF depende do motor de impressão do sistema (WebView). Medidas do CSS podem variar um pouco
  entre Android e iOS; a quebra de página e o cabeçalho repetido se conferem no aparelho.
- O Jest usa mocks de `expo-print`, `expo-sharing` e `expo-file-system`: os testes provam o conteúdo
  e o fluxo, não o arquivo gerado pelo módulo nativo.
- O `shareAsync` não informa se a pessoa enviou ou cancelou. A mensagem de sucesso fala da geração
  ("Relatório gerado."), não do envio.
- O nome da empresa no cabeçalho do PDF vem de `EXPO_PUBLIC_NOME_EMPRESA` (opcional, público por
  design). Vazio, o PDF mostra "Eixo Certo".

## Links

- Linear: EIX-47
- `.specs/features/eix47-exportacao/spec.md`
- Segue o formato de [`docs/adr/0005-reanimated-motion.md`](./0005-reanimated-motion.md)
