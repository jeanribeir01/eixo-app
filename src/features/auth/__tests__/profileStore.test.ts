import { act, renderHook } from '@testing-library/react-native';

import { carregarPerfil, limparPerfil, recarregarPerfil, useProfile, useProfileStore } from '../profileStore';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

// O client é trocado por um builder falso: from().select().eq().maybeSingle() devolve a resposta
// que cada teste definir em `mockMaybeSingle`.
const mockMaybeSingle = jest.fn<Promise<Resposta>, []>();
const mockEq = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: () => ({
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { maybeSingle: () => mockMaybeSingle() };
          },
        }),
      };
    },
  },
}));

const linhaAdmin = {
  id: 'u1',
  nome: 'Ana',
  email: 'ana@empresa.com',
  status: 'Ativo',
  perfil: { nome: 'Admin' },
};

beforeEach(() => {
  mockMaybeSingle.mockReset();
  mockEq.mockReset();
  mockFrom.mockReset();
  limparPerfil();
});

describe('profileStore', () => {
  it('carrega a própria linha de usuario e achata o nome do perfil', async () => {
    mockMaybeSingle.mockResolvedValue({ data: linhaAdmin, error: null });

    await carregarPerfil('u1');

    expect(mockFrom).toHaveBeenCalledWith('usuario');
    expect(mockEq).toHaveBeenCalledWith('id', 'u1');
    expect(useProfileStore.getState()).toMatchObject({
      estado: 'pronto',
      usuario: { id: 'u1', nome: 'Ana', email: 'ana@empresa.com', perfil: 'Admin', status: 'Ativo' },
    });
  });

  it('sem linha em usuario: pronto e sem usuário (tratado como não aprovado)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await carregarPerfil('u1');

    expect(useProfileStore.getState()).toMatchObject({ estado: 'pronto', usuario: null });
  });

  it('erro do Supabase: estado erro', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { code: '500', message: 'falhou' } });

    await carregarPerfil('u1');

    expect(useProfileStore.getState()).toMatchObject({ estado: 'erro', usuario: null });
  });

  it('resposta fora do formato (status desconhecido): estado erro', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...linhaAdmin, status: 'Aprovado' }, error: null });

    await carregarPerfil('u1');

    expect(useProfileStore.getState()).toMatchObject({ estado: 'erro', usuario: null });
  });

  it('logout descarta o perfil carregado', async () => {
    mockMaybeSingle.mockResolvedValue({ data: linhaAdmin, error: null });
    await carregarPerfil('u1');

    limparPerfil();

    expect(useProfileStore.getState()).toMatchObject({ usuarioId: null, usuario: null, estado: 'carregando' });
  });

  it('resposta que chega depois do logout é ignorada', async () => {
    let responder: (resposta: Resposta) => void = () => {};
    mockMaybeSingle.mockReturnValue(new Promise<Resposta>((resolve) => (responder = resolve)));

    const carregando = carregarPerfil('u1');
    limparPerfil();
    responder({ data: linhaAdmin, error: null });
    await carregando;

    expect(useProfileStore.getState().usuario).toBeNull();
  });

  it('recarregarPerfil busca de novo a mesma conta', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: '500', message: 'x' } });
    await carregarPerfil('u1');
    mockMaybeSingle.mockResolvedValueOnce({ data: linhaAdmin, error: null });

    await recarregarPerfil();

    expect(mockEq).toHaveBeenLastCalledWith('id', 'u1');
    expect(useProfileStore.getState()).toMatchObject({ estado: 'pronto', usuario: { perfil: 'Admin' } });
  });
});

describe('useProfile', () => {
  it('expõe usuario, estado e os helpers de permissão (AC5)', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...linhaAdmin, perfil: { nome: 'Financeiro' } },
      error: null,
    });
    const { result } = renderHook(() => useProfile());

    await act(() => carregarPerfil('u1'));

    expect(result.current).toMatchObject({
      estado: 'pronto',
      usuario: { id: 'u1', perfil: 'Financeiro', status: 'Ativo' },
      isAprovado: true,
      isAdmin: false,
      canSeeFinanceiro: true,
      canSeeFrota: false,
    });
    expect(result.current.recarregar).toBe(recarregarPerfil);
  });

  it('usuário pendente: todos os helpers false', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...linhaAdmin, status: 'AguardandoAprovacao' }, error: null });
    const { result } = renderHook(() => useProfile());

    await act(() => carregarPerfil('u1'));

    expect(result.current).toMatchObject({
      isAprovado: false,
      isAdmin: false,
      canSeeFinanceiro: false,
      canSeeFrota: false,
    });
  });
});
