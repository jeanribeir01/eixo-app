import { pedeAtencao, pedeAtencaoFrota } from '../pedeAtencao';

import { manutencao, usuario } from '../__mocks__/fixtures';

const BASE = {
  hoje: '2026-11-23',
  ateData: '2026-11-29',
  aPagarCentavos: 0,
  aReceberCentavos: 0,
  usuariosAguardando: null,
  manutencoesAbertas: null,
};

describe('pedeAtencao (Início de Admin e Financeiro)', () => {
  it('sem pendência nenhuma, a lista vem vazia (a tela mostra "Tudo em dia")', () => {
    expect(pedeAtencao(BASE)).toEqual([]);
  });

  it('contas a pagar: valor e data final da janela de 7 dias, em warning, levando para Movimentações', () => {
    const [item] = pedeAtencao({ ...BASE, aPagarCentavos: 934000 });

    expect(item).toMatchObject({
      id: 'pagar',
      titulo: 'Contas a pagar nos próximos 7 dias',
      detalhe: 'R$ 9.340,00 até 29/11',
      tom: 'warning',
      href: '/movimentacoes',
    });
  });

  it('usuários aguardando: nome de quem pediu; com mais de um, "e mais N"', () => {
    const um = pedeAtencao({ ...BASE, usuariosAguardando: [usuario()] });
    expect(um[0]).toMatchObject({ titulo: '1 usuário aguardando aprovação', detalhe: 'Lucas Martins pediu acesso', href: '/usuarios' });

    const tres = pedeAtencao({
      ...BASE,
      usuariosAguardando: [usuario(), usuario({ id: 'u2', nome: 'Ana' }), usuario({ id: 'u3', nome: 'Bia' })],
    });
    expect(tres[0]).toMatchObject({ titulo: '3 usuários aguardando aprovação', detalhe: 'Lucas Martins e mais 2' });
  });

  it('manutenção aberta: há quantos dias a mais antiga está aberta, com placa e descrição', () => {
    const [item] = pedeAtencao({
      ...BASE,
      manutencoesAbertas: [manutencao({ data_manutencao: '2026-11-19' })],
    });
    expect(item).toMatchObject({ titulo: 'Manutenção aberta há 4 dias', detalhe: 'PWX9J13 · Retífica do motor' });

    const [varias] = pedeAtencao({
      ...BASE,
      manutencoesAbertas: [
        manutencao({ id: 'a', data_manutencao: '2026-11-20', placa: 'NOVA123' }),
        manutencao({ id: 'b', data_manutencao: '2026-11-02', placa: 'ANTIGA1', descricao: 'Troca de pneus' }),
      ],
    });
    expect(varias).toMatchObject({ titulo: '2 manutenções abertas', detalhe: 'ANTIGA1 · Troca de pneus' });
  });

  it('ordem de urgência: pagar, receber, usuários e manutenções', () => {
    const itens = pedeAtencao({
      ...BASE,
      aPagarCentavos: 1,
      aReceberCentavos: 1,
      usuariosAguardando: [usuario()],
      manutencoesAbertas: [manutencao()],
    });

    expect(itens.map((item) => item.id)).toEqual(['pagar', 'receber', 'usuarios', 'manutencoes']);
  });

  it('perfil que não vê o assunto (null) não gera linha', () => {
    expect(pedeAtencao({ ...BASE, usuariosAguardando: null, manutencoesAbertas: null })).toEqual([]);
  });
});

describe('pedeAtencaoFrota (Início do Gestor de Frota)', () => {
  it('revisões primeiro, depois manutenção aberta', () => {
    const itens = pedeAtencaoFrota({ hoje: '2026-11-23', revisoesPendentes: 2, manutencoesAbertas: [manutencao()] });

    expect(itens.map((item) => item.id)).toEqual(['revisoes', 'manutencoes']);
    expect(itens[0]).toMatchObject({ titulo: '2 viagens para revisar', tom: 'warning', href: '/viagens/revisoes' });
  });

  it('sem revisão e sem manutenção, nada pede atenção', () => {
    expect(pedeAtencaoFrota({ hoje: '2026-11-23', revisoesPendentes: 0, manutencoesAbertas: [] })).toEqual([]);
  });
});
