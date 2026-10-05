import { resumoCaixaComDados, resumoCaixaVazio } from '../../__mocks__/resumoCaixaMock';
import { buscarResumoCaixa, validarResumoCaixa } from '../fonteResumoCaixa';

describe('fonteResumoCaixa', () => {
  it('devolve o resumo do mock validado pelo contrato', async () => {
    await expect(buscarResumoCaixa()).resolves.toEqual({ ok: true, data: resumoCaixaComDados });
  });

  it('aceita a base vazia', () => {
    expect(validarResumoCaixa(resumoCaixaVazio)).toEqual({ ok: true, data: resumoCaixaVazio });
  });

  it('recusa valor em ponto flutuante: dinheiro chega em centavos inteiros', () => {
    const resultado = validarResumoCaixa({ ...resumoCaixaComDados, saldoAtualCentavos: 12.5 });

    expect(resultado).toEqual({ ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' });
  });

  it('recusa mês fora do formato AAAA-MM', () => {
    const projecao = [{ ...resumoCaixaComDados.projecao[0], mes: '2026-13' }];

    expect(validarResumoCaixa({ ...resumoCaixaComDados, projecao }).ok).toBe(false);
  });
});
