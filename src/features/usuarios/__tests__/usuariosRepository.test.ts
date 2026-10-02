import {
  alterarPerfilUsuario,
  alterarStatusUsuario,
  buscarUsuarioPorId,
  listarPerfis,
  listarUsuarios,
} from '../usuariosRepository';

// Nenhum teste chama o banco real: cada `supabase.from()` devolve um builder falso que registra os
// métodos chamados e resolve com a resposta definida no teste (mesmo molde de categoriasRepository).
type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = ['select', 'update', 'eq', 'order', 'limit', 'maybeSingle'] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function responder(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
    then: <R1, R2>(
      onFulfilled?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ) => Promise.resolve(resposta).then(onFulfilled, onRejected),
  });
  for (const metodo of METODOS) {
    metodos[metodo] = metodo === 'maybeSingle' ? jest.fn(() => Promise.resolve(resposta)) : jest.fn(() => builder);
  }
  mockFrom.mockReturnValue(builder);
  return builder;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string): Resposta => ({ data: null, error: { code, message: `detalhe técnico ${code}` } });

const ana = {
  id: 'u1',
  nome: 'Ana',
  email: 'ana@empresa.com',
  status: 'AguardandoAprovacao',
  perfil: { id: 'p-mot', nome: 'Motorista' },
};

beforeEach(() => {
  mockFrom.mockReset();
});

describe('listarUsuarios', () => {
  it('devolve nome, e-mail, perfil e status de cada usuário', async () => {
    const builder = responder(ok([ana]));

    const resultado = await listarUsuarios();

    expect(mockFrom).toHaveBeenCalledWith('usuario');
    expect(builder.select).toHaveBeenCalledWith('id, nome, email, status, perfil:perfil_id(id, nome)');
    expect(resultado).toEqual({ ok: true, data: [ana] });
  });

  it('erro do Supabase vira mensagem em português, sem detalhe técnico', async () => {
    responder(erro('500'));

    expect(await listarUsuarios()).toEqual({
      ok: false,
      mensagem: 'Não foi possível carregar os usuários. Tente novamente.',
    });
  });

  it('resposta fora do formato é recusada', async () => {
    responder(ok([{ ...ana, status: 'Ativo' }]));

    expect(await listarUsuarios()).toEqual({ ok: false, mensagem: 'Os dados recebidos são inválidos. Tente novamente.' });
  });
});

describe('buscarUsuarioPorId', () => {
  it('devolve o usuário pelo id', async () => {
    const builder = responder(ok(ana));

    expect(await buscarUsuarioPorId('u1')).toEqual({ ok: true, data: ana });
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('sem linha: "Usuário não encontrado."', async () => {
    responder(ok(null));

    expect(await buscarUsuarioPorId('u1')).toEqual({ ok: false, mensagem: 'Usuário não encontrado.' });
  });
});

describe('listarPerfis', () => {
  it('devolve os perfis do banco', async () => {
    responder(ok([{ id: 'p-adm', nome: 'Admin' }]));

    expect(await listarPerfis()).toEqual({ ok: true, data: [{ id: 'p-adm', nome: 'Admin' }] });
    expect(mockFrom).toHaveBeenCalledWith('perfil');
  });

  it('erro do Supabase vira mensagem em português', async () => {
    responder(erro('500'));

    expect(await listarPerfis()).toEqual({ ok: false, mensagem: 'Não foi possível carregar os perfis. Tente novamente.' });
  });
});

describe('alterarPerfilUsuario', () => {
  it('grava o novo perfil_id do usuário e devolve a linha atualizada (AC5)', async () => {
    const atualizado = { ...ana, perfil: { id: 'p-fin', nome: 'Financeiro' } };
    const builder = responder(ok(atualizado));

    const resultado = await alterarPerfilUsuario('u1', 'p-fin');

    expect(builder.update).toHaveBeenCalledWith({ perfil_id: 'p-fin' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'u1');
    expect(resultado).toEqual({ ok: true, data: atualizado });
  });

  it('42501 (alterar o próprio perfil): mensagem específica', async () => {
    responder(erro('42501'));

    expect(await alterarPerfilUsuario('u1', 'p-fin')).toEqual({
      ok: false,
      mensagem: 'Você não pode alterar o próprio perfil ou status.',
    });
  });

  it('outro erro: mensagem padrão em português (AC8)', async () => {
    responder(erro('500'));

    expect(await alterarPerfilUsuario('u1', 'p-fin')).toEqual({
      ok: false,
      mensagem: 'Não foi possível alterar o perfil. Tente novamente.',
    });
  });

  it('update recusado pelo RLS (sem linha de volta): "Usuário não encontrado."', async () => {
    responder(ok(null));

    expect(await alterarPerfilUsuario('u1', 'p-fin')).toEqual({ ok: false, mensagem: 'Usuário não encontrado.' });
  });
});

describe('alterarStatusUsuario', () => {
  it.each(['Aprovado', 'Bloqueado'] as const)('grava o status %s (AC6, AC7)', async (status) => {
    const builder = responder(ok({ ...ana, status }));

    const resultado = await alterarStatusUsuario('u1', status);

    expect(builder.update).toHaveBeenCalledWith({ status });
    expect(resultado).toEqual({ ok: true, data: { ...ana, status } });
  });

  it('erro: mensagem padrão em português (AC8)', async () => {
    responder(erro('500'));

    expect(await alterarStatusUsuario('u1', 'Aprovado')).toEqual({
      ok: false,
      mensagem: 'Não foi possível alterar o status. Tente novamente.',
    });
  });
});
