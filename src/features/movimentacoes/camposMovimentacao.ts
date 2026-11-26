import type { MovimentacaoFormValues } from './schema';

// O formulário é montado a partir desta lista (pedido da EIX-33): a US09 (vincular viagem) e
// a US03-b (anexo) acrescentam itens aqui e um `case` no MovimentacaoFormView, sem reescrever
// a tela. A ordem da lista é a ordem na tela.
export type TipoCampo =
  | 'moeda'
  | 'texto'
  | 'categoria'
  | 'formaPagamento'
  | 'viagem'
  | 'litros'
  | 'data'
  | 'status'
  | 'anexo';

// O que a tela sabe além dos valores digitados e que decide se um campo aparece.
export type ContextoCampos = {
  // A categoria escolhida é Combustível (Saída)?
  combustivel: boolean;
};

export type CampoMovimentacao = {
  nome: keyof MovimentacaoFormValues;
  tipo: TipoCampo;
  rotulo: string;
  placeholder?: string;
  // Sem `visivel`, o campo aparece sempre.
  visivel?: (valores: MovimentacaoFormValues, contexto: ContextoCampos) => boolean;
};

// Ordem do protótipo: o que é (descrição, categoria, valor), como sai do caixa (forma, viagem) e quando
// (situação e datas). O tipo (Saída/Entrada) fica acima de tudo, fora desta lista, porque filtra as categorias.
export const camposMovimentacao: CampoMovimentacao[] = [
  { nome: 'descricao', tipo: 'texto', rotulo: 'Descrição', placeholder: 'Ex.: Frete São Paulo–Curitiba' },
  { nome: 'categoriaId', tipo: 'categoria', rotulo: 'Categoria' },
  { nome: 'valorCentavos', tipo: 'moeda', rotulo: 'Valor' },
  { nome: 'formaPagamentoId', tipo: 'formaPagamento', rotulo: 'Forma de pagamento' },
  // US09: opcional. Sem viagem, o lançamento é despesa de escritório.
  { nome: 'viagemId', tipo: 'viagem', rotulo: 'Viagem (opcional)' },
  // US09: só no Combustível. É o dado do KM/L da US10.
  {
    nome: 'litros',
    tipo: 'litros',
    rotulo: 'Litros abastecidos',
    placeholder: 'Ex.: 412,5',
    visivel: (_valores, contexto) => contexto.combustivel,
  },
  { nome: 'status', tipo: 'status', rotulo: 'Situação' },
  { nome: 'dataVencimento', tipo: 'data', rotulo: 'Data de vencimento' },
  // O rótulo final ("pagamento" ou "recebimento") depende do tipo; ver a tela.
  { nome: 'dataPagamento', tipo: 'data', rotulo: 'Data de pagamento', visivel: (valores) => valores.status === 'Pago' },
  { nome: 'caminhoComprovante', tipo: 'anexo', rotulo: 'Comprovante (opcional)' },
];
