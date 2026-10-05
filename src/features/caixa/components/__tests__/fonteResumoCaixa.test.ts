import { resumoCaixaComDados, resumoCaixaVazio } from '../../__mocks__/resumoCaixaMock';
import { buscarResumoCaixa, validarResumoCaixa } from '../fonteResumoCaixa';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const mockRpc = jest.fn<Promise<Resposta>, [string]>();

jest.mock('@/supabase/client', () => ({
  supabase: { rpc: (nome: string) => mockRpc(nome) },
}));

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

describe('fonteResumoCaixa', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('busca o resumo no RPC resumo_caixa e devolve validado pelo contrato', async () => {
    mockRpc.mockResolvedValueOnce(ok(resumoCaixaComDados));

    await expect(buscarResumoCaixa()).resolves.toEqual({ ok: true, data: resumoCaixaComDados });
    expect(mockRpc).toHaveBeenCalledWith('resumo_caixa');
  });

  it('aceita a base vazia', async () => {
    mockRpc.mockResolvedValueOnce(ok(resumoCaixaVazio));

    await expect(buscarResumoCaixa()).resolves.toEqual({ ok: true, data: resumoCaixaVazio });
  });

  it('erro do banco vira mensagem em português, sem vazar o detalhe técnico', async () => {
    mockRpc.mockResolvedValueOnce(erro('PGRST301'));

    await expect(buscarResumoCaixa()).resolves.toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar o saldo. Tente novamente.',
    });
  });

  it('perfil sem permissão (42501) recebe mensagem própria', async () => {
    mockRpc.mockResolvedValueOnce(erro('42501'));

    await expect(buscarResumoCaixa()).resolves.toEqual({
      ok: false,
      mensagem: 'Você não tem permissão para ver o saldo.',
    });
  });

  it('resposta fora do contrato é recusada', async () => {
    mockRpc.mockResolvedValueOnce(ok({ ...resumoCaixaComDados, projecao: null }));

    await expect(buscarResumoCaixa()).resolves.toEqual({
      ok: false,
      mensagem: 'Os dados recebidos são inválidos. Tente novamente.',
    });
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
