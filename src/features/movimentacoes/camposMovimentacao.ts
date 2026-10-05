import type { MovimentacaoFormValues } from './schema';

// O formulário é montado a partir desta lista (pedido da EIX-33): a US09 (vincular viagem) e
// a US03-b (anexo) acrescentam itens aqui e um `case` no MovimentacaoFormView, sem reescrever
// a tela. A ordem da lista é a ordem na tela.
export type TipoCampo = 'moeda' | 'texto' | 'categoria' | 'formaPagamento' | 'data' | 'status';

export type CampoMovimentacao = {
  nome: keyof MovimentacaoFormValues;
  tipo: TipoCampo;
  rotulo: string;
  placeholder?: string;
  // Sem `visivel`, o campo aparece sempre.
  visivel?: (valores: MovimentacaoFormValues) => boolean;
};

export const camposMovimentacao: CampoMovimentacao[] = [
  { nome: 'valorCentavos', tipo: 'moeda', rotulo: 'Valor (R$)' },
  { nome: 'descricao', tipo: 'texto', rotulo: 'Descrição', placeholder: 'Ex.: Frete São Paulo–Curitiba' },
  { nome: 'categoriaId', tipo: 'categoria', rotulo: 'Categoria' },
  { nome: 'formaPagamentoId', tipo: 'formaPagamento', rotulo: 'Forma de pagamento' },
  { nome: 'dataVencimento', tipo: 'data', rotulo: 'Data de vencimento' },
  { nome: 'status', tipo: 'status', rotulo: 'Status' },
  // O rótulo final ("pagamento" ou "recebimento") depende do tipo da categoria; ver a tela.
  { nome: 'dataPagamento', tipo: 'data', rotulo: 'Data de pagamento', visivel: (valores) => valores.status === 'Pago' },
];
