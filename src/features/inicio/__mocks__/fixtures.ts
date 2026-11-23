import type { ManutencaoComPlaca } from '@/features/manutencao/types';
import type { Movimentacao } from '@/features/movimentacoes/types';
import type { Usuario } from '@/features/usuarios/types';
import type { ViagemDetalhada } from '@/features/viagens/types';

import type { ResumoInicioFinanceiro } from '../inicioFinanceiroRepository';
import type { ResumoInicioFrota } from '../inicioFrotaRepository';

// Dados de exemplo dos testes do Início, no formato que os repositórios devolvem.

export function movimentacao(sobrescrever: Partial<Movimentacao> = {}): Movimentacao {
  return {
    id: 'mov',
    valorCentavos: 100,
    descricao: 'Descrição',
    categoria_id: 'cat',
    forma_pagamento_id: 'fp',
    divida_id: null,
    viagem_id: null,
    litros: null,
    data_vencimento: '2026-11-10',
    data_pagamento: null,
    data_inclusao: '2026-11-01T12:00:00+00:00',
    status_pagamento: 'Pendente',
    caminho_comprovante: null,
    categoria: { titulo: 'Combustível', tipo: 'Saida', ativa: true },
    formaPagamento: { nome: 'Pix', ativa: true },
    ...sobrescrever,
  };
}

export function manutencao(sobrescrever: Partial<ManutencaoComPlaca> = {}): ManutencaoComPlaca {
  return {
    id: 'man',
    veiculo_id: 'v1',
    descricao: 'Retífica do motor',
    data_manutencao: '2026-11-19',
    valorCentavos: 1845000,
    data_conclusao: null,
    placa: 'PWX9J13',
    ...sobrescrever,
  };
}

export function usuario(sobrescrever: Partial<Usuario> = {}): Usuario {
  return {
    id: 'u1',
    nome: 'Lucas Martins',
    email: 'lucas@empresa.com',
    status: 'AguardandoAprovacao',
    perfil: { id: 'p-motorista', nome: 'Motorista' },
    ...sobrescrever,
  };
}

export function resumoFinanceiro(sobrescrever: Partial<ResumoInicioFinanceiro> = {}): ResumoInicioFinanceiro {
  return {
    saldoAtualCentavos: 7639064,
    entradasDoMesCentavos: 8510000,
    saidasDoMesCentavos: 9100000,
    aPagarCentavos: 934000,
    aReceberCentavos: 0,
    ateData: '2026-11-29',
    ultimasMovimentacoes: [
      movimentacao({
        id: 'frete',
        descricao: 'Frete para BH',
        valorCentavos: 508167,
        status_pagamento: 'Pago',
        categoria: { titulo: 'Frete', tipo: 'Entrada', ativa: true },
      }),
      movimentacao({ id: 'diesel', descricao: 'Diesel S10', valorCentavos: 109598, formaPagamento: { nome: 'Cartão', ativa: true } }),
    ],
    usuariosAguardando: null,
    manutencoesAbertas: null,
    ...sobrescrever,
  };
}

export function viagem(sobrescrever: Partial<ViagemDetalhada> = {}): ViagemDetalhada {
  return {
    id: 'vg1',
    veiculo_id: 'v1',
    rota_id: 'r1',
    motorista_id: 'm1',
    hodometro_inicial: 124580,
    hodometro_final: null,
    km_rodado: null,
    data_inicio: '2026-11-23T11:15:00.000Z',
    data_fim: null,
    status: 'EmAndamento',
    data_inclusao: '2026-11-23T11:15:00.000Z',
    data_atualizacao: '2026-11-23T11:15:00.000Z',
    em_revisao: false,
    veiculo: { id: 'v1', placa: 'RTA4B21', marca: 'Volvo', modelo: 'FH 540', status: 'EmViagem' },
    rota: {
      id: 'r1',
      cidade_origem: 'Campinas',
      uf_origem: 'SP',
      cidade_destino: 'Belo Horizonte',
      uf_destino: 'MG',
      distancia_estimada_km: 590,
    },
    motorista: { id: 'm1', nome: 'Carlos Almeida' },
    ...sobrescrever,
  } as ViagemDetalhada;
}

export function resumoFrota(sobrescrever: Partial<ResumoInicioFrota> = {}): ResumoInicioFrota {
  return {
    viagensEmAndamento: [viagem()],
    veiculos: { Disponivel: 3, EmViagem: 2, EmManutencao: 1 },
    revisoesPendentes: 1,
    manutencoesAbertas: [manutencao()],
    ...sobrescrever,
  };
}
