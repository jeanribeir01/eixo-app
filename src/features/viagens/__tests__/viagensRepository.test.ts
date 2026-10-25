import {
  abrirViagemComUltimoHodometroSchema,
  abrirViagemSchema,
  fecharViagemFormSchema,
  fecharViagemSchema,
} from '../schema';
import {
  abrirViagem,
  buscarUltimoHodometro,
  buscarViagemPorId,
  fecharViagem,
  listarMotoristasAtivos,
  listarRotasAtivas,
  listarViagens,
  MENSAGEM_VIAGEM_NAO_ABERTA,
  MENSAGENS_ERRO_CONSTRAINT_VIAGEM,
  MENSAGENS_ERRO_VIAGEM,
  traduzirErroBanco,
  viagensRepository,
} from '../viagensRepository';
import type { NovaViagemInput, ViagensRepository } from '../types';

type Resposta = { data: unknown; error: { code: string; message: string } | null };

const METODOS = [
  'select',
  'insert',
  'update',
  'delete',
  'eq',
  'not',
  'order',
  'limit',
  'single',
  'maybeSingle',
] as const;
type Metodo = (typeof METODOS)[number];
type Builder = Record<Metodo, jest.Mock> & PromiseLike<Resposta>;

const mockFrom = jest.fn();

jest.mock('@/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

function criarBuilder(resposta: Resposta): Builder {
  const metodos = {} as Record<Metodo, jest.Mock>;
  const builder: Builder = Object.assign(metodos, {
    then: <R1, R2>(
      onFulfilled?: ((valor: Resposta) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
    ) => Promise.resolve(resposta).then(onFulfilled, onRejected),
  });

  for (const metodo of METODOS) {
    metodos[metodo] =
      metodo === 'single' || metodo === 'maybeSingle'
        ? jest.fn(() => Promise.resolve(resposta))
        : jest.fn(() => builder);
  }

  return builder;
}

function responder(...respostas: Resposta[]): Builder[] {
  const builders = respostas.map(criarBuilder);
  const fila = [...builders];
  mockFrom.mockImplementation(() => {
    const proximo = fila.shift();
    if (!proximo) throw new Error('from() chamado mais vezes que o esperado');
    return proximo;
  });
  return builders;
}

const ok = (data: unknown): Resposta => ({ data, error: null });
const erro = (code: string, message = `detalhe ${code}`): Resposta => ({
  data: null,
  error: { code, message },
});

function erroDeConstraint(code: '23505' | '23514', constraint: string): Resposta {
  return erro(
    code,
    code === '23505'
      ? `duplicate key value violates unique constraint "${constraint}"`
      : `new row for relation "viagem" violates check constraint "${constraint}"`,
  );
}

const viagemBase = {
  id: 'v1',
  veiculo_id: 'veic-1',
  rota_id: 'rota-1',
  motorista_id: 'mot-1',
  hodometro_inicial: 10000,
  hodometro_final: null,
  data_inicio: '2026-10-18T10:00:00Z',
  data_fim: null,
  status: 'EmAndamento' as const,
  km_rodado: null,
  data_inclusao: '2026-10-18T10:00:00Z',
  data_atualizacao: '2026-10-18T10:00:00Z',
};

const viagemDetalhada = {
  ...viagemBase,
  veiculo: {
    id: 'veic-1',
    placa: 'ABC1D23',
    marca: 'Scania',
    modelo: 'R450',
    status: 'EmViagem' as const,
  },
  rota: {
    id: 'rota-1',
    cidade_origem: 'São Paulo',
    uf_origem: 'SP' as const,
    cidade_destino: 'Curitiba',
    uf_destino: 'PR' as const,
    distancia_estimada_km: 400,
  },
  motorista: {
    id: 'mot-1',
    nome: 'Carlos da Silva',
    email: 'carlos@transportadora.com',
  },
};

describe('viagensRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mapeamento de erros do banco (VG001 a VG007)', () => {
    it.each([
      ['VG001', MENSAGENS_ERRO_VIAGEM.VG001, 'veiculo_id'],
      ['VG002', MENSAGENS_ERRO_VIAGEM.VG002, 'veiculo_id'],
      ['VG003', MENSAGENS_ERRO_VIAGEM.VG003, 'veiculo_id'],
      ['VG004', MENSAGENS_ERRO_VIAGEM.VG004, 'hodometro_inicial'],
      ['VG005', MENSAGENS_ERRO_VIAGEM.VG005, 'status'],
      ['VG006', MENSAGENS_ERRO_VIAGEM.VG006, 'veiculo_id'],
      ['VG007', MENSAGENS_ERRO_VIAGEM.VG007, 'hodometro_final'],
      ['428C9', MENSAGENS_ERRO_VIAGEM['428C9'], undefined],
    ])('mapeia código %s para mensagem amigável e campo correspondente', (code, mensagemEsperada, campoEsperado) => {
      const resultado = traduzirErroBanco({ code }, 'Erro padrão');
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.mensagem).toBe(mensagemEsperada);
        expect(resultado.campo).toBe(campoEsperado);
        expect(resultado.codigo).toBe(code);
      }
    });

    it('mapeia 42501 para acesso negado', () => {
      const resultado = traduzirErroBanco({ code: '42501' }, 'Erro padrão');
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.mensagem).toContain('Acesso negado');
      }
    });

    it('usa a mensagem padrão para códigos desconhecidos', () => {
      const resultado = traduzirErroBanco({ code: '99999' }, 'Ocorreu uma falha inesperada.');
      expect(resultado).toEqual({
        ok: false,
        mensagem: 'Ocorreu uma falha inesperada.',
        codigo: '99999',
      });
    });
  });

  describe('Diferenciação de 23505 e 23514 pela constraint', () => {
    it('23505 do índice de viagem em andamento vira "veículo em andamento"', () => {
      const resposta = erroDeConstraint('23505', 'viagem_um_andamento_por_veiculo');
      const resultado = traduzirErroBanco(resposta.error!, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_um_andamento_por_veiculo,
        campo: 'veiculo_id',
        codigo: '23505',
      });
    });

    it('23505 da chave primária não vira "veículo em andamento"', () => {
      const resposta = erroDeConstraint('23505', 'viagem_pkey');
      const resultado = traduzirErroBanco(resposta.error!, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_pkey,
        codigo: '23505',
      });
    });

    it('23505 sem constraint identificada usa o fallback de registro duplicado', () => {
      const resultado = traduzirErroBanco({ code: '23505', message: 'detalhe técnico' }, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM['23505'],
        codigo: '23505',
      });
    });

    it.each([
      [
        'viagem_hodometro_inicial_nao_negativo',
        MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_hodometro_inicial_nao_negativo,
        'hodometro_inicial',
      ],
      [
        'viagem_hodometro_final_maior',
        MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_hodometro_final_maior,
        'hodometro_final',
      ],
      [
        'viagem_finalizada_tem_hodometro_final',
        MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_finalizada_tem_hodometro_final,
        'hodometro_final',
      ],
    ] as const)('23514 da constraint %s tem mensagem e campo próprios', (constraint, mensagemEsperada, campoEsperado) => {
      const resposta = erroDeConstraint('23514', constraint);
      const resultado = traduzirErroBanco(resposta.error!, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: mensagemEsperada,
        campo: campoEsperado,
        codigo: '23514',
      });
    });

    it('23514 sem constraint identificada usa o fallback de hodômetro inválido', () => {
      const resultado = traduzirErroBanco({ code: '23514', message: 'detalhe técnico' }, 'Erro padrão');

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
        codigo: '23514',
      });
    });
  });

  describe('Validação de Schemas Zod', () => {
    it('valida payload correto de abertura de viagem', () => {
      const input: NovaViagemInput = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 15000,
      };

      const resultado = abrirViagemSchema.safeParse(input);
      expect(resultado.success).toBe(true);
    });

    it('rejeita hodômetro inicial negativo', () => {
      const input = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: -1,
      };

      const resultado = abrirViagemSchema.safeParse(input);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]?.message).toBe('O hodômetro inicial não pode ser negativo.');
      }
    });

    it('rejeita abertura sem veículo selecionado', () => {
      const input = {
        veiculo_id: '',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 1000,
      };

      const resultado = abrirViagemSchema.safeParse(input);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]?.message).toBe('Selecione um veículo.');
      }
    });

    it('rejeita fechamento com hodômetro final zero ou negativo', () => {
      const resultadoZero = fecharViagemSchema.safeParse({ hodometro_final: 0 });
      expect(resultadoZero.success).toBe(false);

      const resultadoNegativo = fecharViagemSchema.safeParse({ hodometro_final: -50 });
      expect(resultadoNegativo.success).toBe(false);
    });

    it.each([9999, 10000])(
      'rejeita no formulário o final menor ou igual ao inicial (%s) usando a mensagem do schema',
      (hodometroFinal) => {
        const resultado = fecharViagemFormSchema.safeParse({
          hodometro_inicial: 10000,
          hodometro_final: hodometroFinal,
        });

        expect(resultado.success).toBe(false);
        if (!resultado.success) {
          expect(resultado.error.issues[0]?.message).toBe(
            'O hodômetro final deve ser maior que o inicial (10.000 km).',
          );
        }
      },
    );

    it('bloqueia o inicial menor que o último final no schema contextual e aceita o igual', () => {
      const base = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
      };

      const menor = abrirViagemComUltimoHodometroSchema(15000).safeParse({
        ...base,
        hodometro_inicial: 14000,
      });
      expect(menor.success).toBe(false);
      if (!menor.success) {
        expect(menor.error.issues[0]?.message).toBe(
          'O hodômetro inicial não pode ser menor que o último final (15.000 km).',
        );
        expect(menor.error.issues[0]?.path).toEqual(['hodometro_inicial']);
      }

      const igual = abrirViagemComUltimoHodometroSchema(15000).safeParse({
        ...base,
        hodometro_inicial: 15000,
      });
      expect(igual.success).toBe(true);
    });

    it.each([
      ['data_inicio', { ...{ veiculo_id: 'veic-1', rota_id: 'rota-1', motorista_id: 'mot-1', hodometro_inicial: 1000 }, data_inicio: '' }, 'Data de início inválida.'],
      ['data_fim', { hodometro_final: 1000, data_fim: '' }, 'Data de fim inválida.'],
    ] as const)('rejeita %s vazia no schema', (campo, input, mensagem) => {
      const resultado =
        campo === 'data_inicio'
          ? abrirViagemSchema.safeParse(input)
          : fecharViagemSchema.safeParse(input);

      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0]?.message).toBe(mensagem);
      }
    });
  });

  describe('Operações do Repositório', () => {
    it('abrirViagem envia colunas corretas sem km_rodado e retorna viagem criada', async () => {
      const [builder] = responder(ok(viagemBase));

      const input: NovaViagemInput = {
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 10000,
      };

      const resultado = await abrirViagem(input);

      expect(resultado).toEqual({ ok: true, data: viagemBase });
      expect(mockFrom).toHaveBeenCalledWith('viagem');
      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          veiculo_id: 'veic-1',
          rota_id: 'rota-1',
          motorista_id: 'mot-1',
          hodometro_inicial: 10000,
          status: 'EmAndamento',
        }),
      );
      // Garante que km_rodado NÃO é enviado (coluna gerada no Postgres, erro 428C9)
      const payloadEnviado = builder.insert.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payloadEnviado.km_rodado).toBeUndefined();
    });

    it('abrirViagem trata erro VG001 quando veículo já possui viagem em andamento', async () => {
      responder(erro('VG001'));

      const resultado = await abrirViagem({
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 10000,
      });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG001,
        campo: 'veiculo_id',
        codigo: 'VG001',
      });
    });

    it('abrirViagem trata erro VG004 quando hodômetro inicial regride', async () => {
      responder(erro('VG004'));

      const resultado = await abrirViagem({
        veiculo_id: 'veic-1',
        rota_id: 'rota-1',
        motorista_id: 'mot-1',
        hodometro_inicial: 5000,
      });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG004,
        campo: 'hodometro_inicial',
        codigo: 'VG004',
      });
    });

    it('fecharViagem atualiza status para Finalizada e hodometro_final', async () => {
      const viagemFinalizada = {
        ...viagemBase,
        status: 'Finalizada' as const,
        hodometro_final: 10400,
        km_rodado: 400,
        data_fim: '2026-10-18T18:00:00Z',
      };
      const [builder] = responder(ok(viagemFinalizada));

      const resultado = await fecharViagem('v1', { hodometro_final: 10400 });

      expect(resultado).toEqual({ ok: true, data: viagemFinalizada });
      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'Finalizada',
          hodometro_final: 10400,
        }),
      );
      expect(builder.eq).toHaveBeenCalledWith('id', 'v1');
      expect(builder.eq).toHaveBeenCalledWith('status', 'EmAndamento');
    });

    it('fecharViagem não regrava viagem já encerrada por outra pessoa', async () => {
      // Com o filtro de status, o update não acha linha e o PostgREST devolve null.
      responder(ok(null));

      const resultado = await fecharViagem('v1', { hodometro_final: 15300 });

      expect(resultado).toEqual({ ok: false, mensagem: MENSAGEM_VIAGEM_NAO_ABERTA, campo: 'status' });
    });

    it('fecharViagem trata erro 23514 quando hodômetro final é menor ou igual ao inicial', async () => {
      responder(erroDeConstraint('23514', 'viagem_hodometro_final_maior'));

      const resultado = await fecharViagem('v1', { hodometro_final: 9000 });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_CONSTRAINT_VIAGEM.viagem_hodometro_final_maior,
        campo: 'hodometro_final',
        codigo: '23514',
      });
    });

    it('fecharViagem trata erro VG005 quando a viagem já está encerrada', async () => {
      responder(erro('VG005'));

      const resultado = await fecharViagem('v1', { hodometro_final: 12000 });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG005,
        campo: 'status',
        codigo: 'VG005',
      });
    });

    it('buscarViagemPorId retorna os dados detalhados ou erro não encontrada', async () => {
      responder(ok(viagemDetalhada));
      const encontrada = await buscarViagemPorId('v1');
      expect(encontrada).toEqual({ ok: true, data: viagemDetalhada });

      responder(ok(null));
      const naoEncontrada = await buscarViagemPorId('inexistente');
      expect(naoEncontrada).toEqual({ ok: false, mensagem: 'Viagem não encontrada.' });
    });

    it('buscarUltimoHodometro retorna o maior hodômetro final do veículo', async () => {
      const [builder] = responder(ok([{ hodometro_final: 15430 }]));

      const resultado = await buscarUltimoHodometro('veic-1');

      expect(resultado).toEqual({ ok: true, data: 15430 });
      expect(builder.eq).toHaveBeenCalledWith('veiculo_id', 'veic-1');
      expect(builder.order).toHaveBeenCalledWith('hodometro_final', { ascending: false });
    });

    it('buscarUltimoHodometro retorna null quando veículo nunca teve viagem encerrada', async () => {
      responder(ok([]));

      const resultado = await buscarUltimoHodometro('veic-novo');

      expect(resultado).toEqual({ ok: true, data: null });
    });

    it('listarRotasAtivas filtra as rotas ativas no banco', async () => {
      const [builder] = responder(ok([viagemDetalhada.rota]));

      const resultado = await listarRotasAtivas();

      expect(resultado).toEqual({ ok: true, data: [viagemDetalhada.rota] });
      expect(mockFrom).toHaveBeenCalledWith('rota');
      expect(builder.eq).toHaveBeenCalledWith('ativa', true);
    });

    it('listarMotoristasAtivos filtra perfil Motorista e status Ativo no banco', async () => {
      const [builder] = responder(
        ok([{ id: 'mot-2', nome: 'João Motorista', email: 'joao@x.com', perfil: { nome: 'Motorista' } }]),
      );

      const resultado = await listarMotoristasAtivos();

      expect(resultado).toEqual({
        ok: true,
        data: [{ id: 'mot-2', nome: 'João Motorista', email: 'joao@x.com' }],
      });
      expect(mockFrom).toHaveBeenCalledWith('usuario');
      expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('perfil_id!inner'));
      expect(builder.eq).toHaveBeenCalledWith('status', 'Ativo');
      expect(builder.eq).toHaveBeenCalledWith('perfil.nome', 'Motorista');
    });

    it('listarViagens aplica filtros de status e veículo e formata lista', async () => {
      const [builder] = responder(ok([viagemDetalhada]));

      const resultado = await listarViagens({
        status: 'EmAndamento',
        veiculo_id: 'veic-1',
      });

      expect(resultado).toEqual({ ok: true, data: [viagemDetalhada] });
      expect(builder.eq).toHaveBeenCalledWith('status', 'EmAndamento');
      expect(builder.eq).toHaveBeenCalledWith('veiculo_id', 'veic-1');
    });

    it('viagensRepository implementa o contrato ViagensRepository', () => {
      const repo: ViagensRepository = viagensRepository;
      expect(repo.listarViagens).toBe(listarViagens);
      expect(repo.buscarViagemPorId).toBe(buscarViagemPorId);
      expect(repo.buscarUltimoHodometro).toBe(buscarUltimoHodometro);
      expect(repo.listarRotasAtivas).toBe(listarRotasAtivas);
      expect(repo.listarMotoristasAtivos).toBe(listarMotoristasAtivos);
      expect(repo.abrirViagem).toBe(abrirViagem);
      expect(repo.fecharViagem).toBe(fecharViagem);
    });
  });
});
