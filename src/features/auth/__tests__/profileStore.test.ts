import { act, renderHook } from '@testing-library/react-native';
import * as Network from 'expo-network';

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

// O perfil offline vem do cache SQLite; aqui o teste decide o que o cache devolve.
const mockLerPerfilDoCache = jest.fn();
jest.mock('@/features/viagens/viagensRepository', () => ({
  lerPerfilDoCacheLocal: (...args: unknown[]) => mockLerPerfilDoCache(...args),
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

  describe('sem internet (RNF01)', () => {
    const erroDeRede = { code: '', message: 'TypeError: Network request failed' };
    const perfilEmCache = {
      id: 'u1',
      nome: 'Carlos',
      email: 'carlos@empresa.com',
      status: 'Ativo' as const,
      perfil: 'Motorista' as const,
      data_atualizacao: '2026-10-18T10:00:00Z',
    };

    beforeEach(() => {
      mockLerPerfilDoCache.mockReset();
      (Network.addNetworkStateListener as jest.Mock).mockClear();
    });

    it('usa o perfil salvo no último sync quando o Supabase não responde', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: erroDeRede });
      mockLerPerfilDoCache.mockReturnValue(perfilEmCache);

      await carregarPerfil('u1');

      expect(mockLerPerfilDoCache).toHaveBeenCalledWith('u1');
      expect(useProfileStore.getState()).toMatchObject({
        estado: 'pronto',
        usuario: { id: 'u1', perfil: 'Motorista', status: 'Ativo' },
      });
    });

    it('também cai no cache quando o client lança exceção de rede', async () => {
      mockMaybeSingle.mockRejectedValue(new TypeError('Network request failed'));
      mockLerPerfilDoCache.mockReturnValue(perfilEmCache);

      await carregarPerfil('u1');

      expect(useProfileStore.getState()).toMatchObject({ estado: 'pronto', usuario: { perfil: 'Motorista' } });
    });

    it('sem cache, continua em erro', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: erroDeRede });
      mockLerPerfilDoCache.mockReturnValue(null);

      await carregarPerfil('u1');

      expect(useProfileStore.getState()).toMatchObject({ estado: 'erro', usuario: null });
    });

    it('erro que não é de rede não usa o cache', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: { code: '500', message: 'falhou' } });
      mockLerPerfilDoCache.mockReturnValue(perfilEmCache);

      await carregarPerfil('u1');

      expect(mockLerPerfilDoCache).not.toHaveBeenCalled();
      expect(useProfileStore.getState()).toMatchObject({ estado: 'erro', usuario: null });
    });

    it('revalida quando a rede volta e aplica um bloqueio feito enquanto estava offline', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: erroDeRede });
      mockLerPerfilDoCache.mockReturnValue(perfilEmCache);
      await carregarPerfil('u1');

      const ouvinte = (Network.addNetworkStateListener as jest.Mock).mock.calls.at(-1)?.[0] as (
        estado: { isConnected: boolean; isInternetReachable: boolean },
      ) => void;
      expect(ouvinte).toBeDefined();

      mockMaybeSingle.mockResolvedValueOnce({
        data: { ...linhaAdmin, status: 'Bloqueado', perfil: { nome: 'Motorista' } },
        error: null,
      });
      await act(async () => {
        ouvinte({ isConnected: true, isInternetReachable: true });
        await Promise.resolve();
      });

      // A revalidação não volta para "carregando" (a área do app não desmonta no meio).
      expect(useProfileStore.getState()).toMatchObject({ estado: 'pronto', usuario: { status: 'Bloqueado' } });
    });
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
