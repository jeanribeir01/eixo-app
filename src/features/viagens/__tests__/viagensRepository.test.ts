import { eq } from 'drizzle-orm';

import * as schema from '@/db/schema';
import { criarBancoDeTeste, type BancoDeTeste } from '@/db/testing';
import { definirUsuarioLocal } from '../sessaoLocal';
import type { NovaViagemInput, ViagensRepository } from '../types';
import {
  abrirViagem,
  abrirViagemSchema,
  buscarUltimoHodometro,
  buscarVeiculoParaViagem,
  buscarViagemEmAndamento,
  buscarViagemPorId,
  cancelarViagem,
  corrigirHodometroFinal,
  corrigirHodometroFinalSchema,
  fecharViagem,
  fecharViagemSchema,
  getDb,
  limparCacheLocalNoLogout,
  listarMotoristasParaViagem,
  listarRotasParaViagem,
  listarVeiculosParaViagem,
  listarViagens,
  MENSAGENS_ERRO_VIAGEM,
  prepararSessaoLocal,
  setDb,
  traduzirErroBanco,
  traduzirErroSqlite,
  viagensRepository,
  type ViagensDb,
} from '../viagensRepository';

const AGORA = '2026-10-18T10:00:00.000Z';
const VEICULO_ID = '00000000-0000-7000-8000-000000000001';
const VEICULO_MANUTENCAO_ID = '00000000-0000-7000-8000-000000000002';
const VEICULO_INATIVO_ID = '00000000-0000-7000-8000-000000000003';
const ROTA_ID = '00000000-0000-7000-8000-000000000004';
const MOTORISTA_ID = '00000000-0000-7000-8000-000000000005';
const OUTRO_MOTORISTA_ID = '00000000-0000-7000-8000-000000000007';
const VIAGEM_ID = '00000000-0000-7000-8000-000000000006';
const USUARIO_LOGADO = 'usuario-logado';

describe('viagensRepository', () => {
  describe('Mapeamento de erros do banco (VG001 a VG007 e 23514)', () => {
    it.each([
      ['VG001', MENSAGENS_ERRO_VIAGEM.VG001, 'veiculo_id'],
      ['VG002', MENSAGENS_ERRO_VIAGEM.VG002, 'veiculo_id'],
      ['VG003', MENSAGENS_ERRO_VIAGEM.VG003, 'veiculo_id'],
      ['VG004', MENSAGENS_ERRO_VIAGEM.VG004, 'hodometro_inicial'],
      ['VG005', MENSAGENS_ERRO_VIAGEM.VG005, 'status'],
      ['VG006', MENSAGENS_ERRO_VIAGEM.VG006, 'veiculo_id'],
      ['VG007', MENSAGENS_ERRO_VIAGEM.VG007, 'hodometro_final'],
      ['23514', MENSAGENS_ERRO_VIAGEM['23514'], undefined],
      ['428C9', MENSAGENS_ERRO_VIAGEM['428C9'], undefined],
    ])(
      'mapeia código %s para mensagem amigável e campo correspondente',
      (code, mensagemEsperada, campoEsperado) => {
        const resultado = traduzirErroBanco({ code }, 'Erro padrão');
        expect(resultado.ok).toBe(false);
        if (!resultado.ok) {
          expect(resultado.mensagem).toBe(mensagemEsperada);
          expect(resultado.campo).toBe(campoEsperado);
          expect(resultado.codigo).toBe(code);
        }
      },
    );

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

    it('traduzirErroSqlite mapeia unique constraint do SQLite para VG001', () => {
      const erroUnique = new Error('UNIQUE constraint failed: viagem.veiculo_id');
      expect(traduzirErroSqlite(erroUnique, 'Falha')).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG001,
        campo: 'veiculo_id',
        codigo: 'VG001',
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
        expect(resultado.error.issues[0]?.message).toBe(
          'O hodômetro inicial não pode ser negativo.',
        );
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

    it('valida correção de hodômetro final', () => {
      const resultadoValido = corrigirHodometroFinalSchema.safeParse({ hodometro_final: 12500 });
      expect(resultadoValido.success).toBe(true);

      const resultadoInvalido = corrigirHodometroFinalSchema.safeParse({ hodometro_final: -10 });
      expect(resultadoInvalido.success).toBe(false);
    });
  });

  describe('Operações do Repositório (SQLite Real + Outbox Transaction)', () => {
    let banco: BancoDeTeste;

    beforeEach(() => {
      definirUsuarioLocal(USUARIO_LOGADO);
      banco = criarBancoDeTeste();
      setDb(banco.db as unknown as ViagensDb);

      banco.db
        .insert(schema.veiculo)
        .values([
          {
            id: VEICULO_ID,
            placa: 'ABC1D23',
            marca: 'Scania',
            modelo: 'R450',
            capacidade_carga: 30,
            status: 'Disponivel',
            data_inclusao: AGORA,
            data_atualizacao: AGORA,
          },
          {
            id: VEICULO_MANUTENCAO_ID,
            placa: 'MAN1D23',
            marca: 'Volvo',
            modelo: 'FH540',
            capacidade_carga: 30,
            status: 'EmManutencao',
            data_inclusao: AGORA,
            data_atualizacao: AGORA,
          },
          {
            id: VEICULO_INATIVO_ID,
            placa: 'INA1D23',
            marca: 'Mercedes',
            modelo: 'Actros',
            capacidade_carga: 25,
            status: 'Inativo',
            data_inclusao: AGORA,
            data_atualizacao: AGORA,
          },
        ])
        .run();

      banco.db
        .insert(schema.rota)
        .values({
          id: ROTA_ID,
          cidade_origem: 'Recife',
          cidade_destino: 'Salvador',
          uf_origem: 'PE',
          uf_destino: 'BA',
          distancia_estimada_km: 800,
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();

      banco.db
        .insert(schema.usuarioCache)
        .values([
          {
            id: MOTORISTA_ID,
            nome: 'Carlos da Silva',
            email: 'carlos@transportadora.com',
            status: 'Ativo',
            perfil: 'Motorista',
            data_atualizacao: AGORA,
          },
          {
            id: OUTRO_MOTORISTA_ID,
            nome: 'Ana Souza',
            email: 'ana@transportadora.com',
            status: 'Ativo',
            perfil: 'Motorista',
            data_atualizacao: AGORA,
          },
        ])
        .run();
    });

    afterEach(() => {
      definirUsuarioLocal(null);
      banco.fechar();
    });

    it('abrirViagem grava na tabela viagem e na fila outbox na mesma transação sem km_rodado', async () => {
      const input: NovaViagemInput = {
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      };

      const resultado = await abrirViagem(input);

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;

      expect(resultado.data).toMatchObject({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
        hodometro_final: null,
        status: 'EmAndamento',
        km_rodado: null,
        em_revisao: false,
      });

      const viagemNoBanco = banco.db
        .select()
        .from(schema.viagem)
        .where(eq(schema.viagem.id, VIAGEM_ID))
        .get();
      expect(viagemNoBanco).toBeDefined();
      expect(viagemNoBanco?.status).toBe('EmAndamento');

      const outboxItems = banco.db.select().from(schema.outbox).all();
      expect(outboxItems).toHaveLength(1);
      const outboxItem = outboxItems[0];
      expect(outboxItem?.entidade).toBe('viagem');
      expect(outboxItem?.operacao).toBe('insert');
      expect(outboxItem?.tentativas).toBe(0);
      expect(outboxItem?.usuario_id).toBe(USUARIO_LOGADO);
      expect(outboxItem?.status).toBe('pendente');

      const payload = JSON.parse(outboxItem?.payload ?? '{}');
      expect(payload.id).toBe(VIAGEM_ID);
      expect(payload.hodometro_inicial).toBe(10000);
      expect(payload.status).toBe('EmAndamento');
      expect(payload.km_rodado).toBeUndefined();
      expect('km_rodado' in payload).toBe(false);
    });

    it('abrirViagem sem sessão não grava nada', async () => {
      definirUsuarioLocal(null);

      const resultado = await abrirViagem({
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      expect(resultado.ok).toBe(false);
      expect(banco.db.select().from(schema.viagem).all()).toHaveLength(0);
      expect(banco.db.select().from(schema.outbox).all()).toHaveLength(0);
    });

    it('abrirViagem rejeita veículo em manutenção (VG002)', async () => {
      const resultado = await abrirViagem({
        veiculo_id: VEICULO_MANUTENCAO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG002,
        campo: 'veiculo_id',
        codigo: 'VG002',
      });

      expect(banco.db.select().from(schema.viagem).all()).toHaveLength(0);
      expect(banco.db.select().from(schema.outbox).all()).toHaveLength(0);
    });

    it('abrirViagem rejeita veículo inativo (VG003)', async () => {
      const resultado = await abrirViagem({
        veiculo_id: VEICULO_INATIVO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG003,
        campo: 'veiculo_id',
        codigo: 'VG003',
      });
    });

    it('abrirViagem rejeita veículo que não está no cache local', async () => {
      const resultado = await abrirViagem({
        veiculo_id: 'veiculo-inexistente',
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      expect(resultado.ok).toBe(false);
      if (!resultado.ok) {
        expect(resultado.mensagem).toContain('Veículo não encontrado no dispositivo');
        expect(resultado.campo).toBe('veiculo_id');
      }
    });

    it('abrirViagem trata erro VG001 quando veículo já possui viagem em andamento', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const resultado = await abrirViagem({
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10500,
      });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG001,
        campo: 'veiculo_id',
        codigo: 'VG001',
      });

      expect(banco.db.select().from(schema.viagem).all()).toHaveLength(1);
      expect(banco.db.select().from(schema.outbox).all()).toHaveLength(1);
    });

    it('abrirViagem trata erro VG004 quando hodômetro inicial regride em relação ao último hodômetro final', async () => {
      banco.db
        .insert(schema.viagem)
        .values({
          id: 'viagem-antiga',
          veiculo_id: VEICULO_ID,
          rota_id: ROTA_ID,
          motorista_id: MOTORISTA_ID,
          hodometro_inicial: 14000,
          hodometro_final: 15000,
          status: 'Finalizada',
          km_rodado: 1000,
          data_inclusao: '2026-10-17T10:00:00.000Z',
          data_atualizacao: '2026-10-17T18:00:00.000Z',
        })
        .run();

      const resultado = await abrirViagem({
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 14500,
      });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG004,
        campo: 'hodometro_inicial',
        codigo: 'VG004',
      });
    });

    it('fecharViagem atualiza status para Finalizada e grava outbox sem km_rodado', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const resultado = await fecharViagem(VIAGEM_ID, { hodometro_final: 10400 });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;

      expect(resultado.data.status).toBe('Finalizada');
      expect(resultado.data.hodometro_final).toBe(10400);
      expect(resultado.data.km_rodado).toBe(400);

      const viagemNoBanco = banco.db
        .select()
        .from(schema.viagem)
        .where(eq(schema.viagem.id, VIAGEM_ID))
        .get();
      expect(viagemNoBanco?.status).toBe('Finalizada');
      expect(viagemNoBanco?.km_rodado).toBe(400);

      const outboxItems = banco.db.select().from(schema.outbox).all();
      expect(outboxItems).toHaveLength(2);

      const updateItem = outboxItems.find((item) => item.operacao === 'update');
      expect(updateItem).toBeDefined();
      const payload = JSON.parse(updateItem?.payload ?? '{}');
      expect(payload.id).toBe(VIAGEM_ID);
      expect(payload.status).toBe('Finalizada');
      expect(payload.hodometro_final).toBe(10400);
      expect(payload.km_rodado).toBeUndefined();
      expect('km_rodado' in payload).toBe(false);
    });

    it('fecharViagem trata erro 23514 quando hodômetro final é menor ou igual ao inicial', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const resultado = await fecharViagem(VIAGEM_ID, { hodometro_final: 9000 });

      expect(resultado).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM['23514'],
        campo: 'hodometro_final',
        codigo: '23514',
      });
    });

    it('fecharViagem trata erro VG005 quando a viagem já está encerrada', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      await fecharViagem(VIAGEM_ID, { hodometro_final: 10400 });

      const segundoFechamento = await fecharViagem(VIAGEM_ID, { hodometro_final: 10500 });

      expect(segundoFechamento).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG005,
        campo: 'status',
        codigo: 'VG005',
      });
    });

    it('cancelarViagem atualiza status para Cancelada e grava na outbox sem km_rodado', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const resultado = await cancelarViagem(VIAGEM_ID);

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;

      expect(resultado.data.status).toBe('Cancelada');

      const outboxItems = banco.db.select().from(schema.outbox).all();
      const cancelItem = outboxItems.find((item) => item.operacao === 'update');
      expect(cancelItem).toBeDefined();
      const payload = JSON.parse(cancelItem?.payload ?? '{}');
      expect(payload.status).toBe('Cancelada');
      expect(payload.km_rodado).toBeUndefined();
    });

    it('corrigirHodometroFinal atualiza hodometro_final e trata VG007', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });
      await fecharViagem(VIAGEM_ID, { hodometro_final: 10400 });

      const sucesso = await corrigirHodometroFinal(VIAGEM_ID, { hodometro_final: 10450 });
      expect(sucesso.ok).toBe(true);
      if (sucesso.ok) {
        expect(sucesso.data.hodometro_final).toBe(10450);
        expect(sucesso.data.km_rodado).toBe(450);
      }

      banco.db
        .insert(schema.viagem)
        .values({
          id: 'viagem-posterior',
          veiculo_id: VEICULO_ID,
          rota_id: ROTA_ID,
          motorista_id: MOTORISTA_ID,
          hodometro_inicial: 10500,
          status: 'EmAndamento',
          data_inclusao: '2026-10-18T19:00:00.000Z',
          data_atualizacao: '2026-10-18T19:00:00.000Z',
        })
        .run();

      const falha = await corrigirHodometroFinal(VIAGEM_ID, { hodometro_final: 10600 });
      expect(falha).toEqual({
        ok: false,
        mensagem: MENSAGENS_ERRO_VIAGEM.VG007,
        campo: 'hodometro_final',
        codigo: 'VG007',
      });
    });

    it('buscarViagemPorId retorna os dados detalhados ou erro não encontrada', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const encontrada = await buscarViagemPorId(VIAGEM_ID);
      expect(encontrada.ok).toBe(true);
      if (encontrada.ok) {
        expect(encontrada.data.id).toBe(VIAGEM_ID);
        expect(encontrada.data.veiculo?.placa).toBe('ABC1D23');
        expect(encontrada.data.rota?.cidade_origem).toBe('Recife');
        expect(encontrada.data.motorista?.nome).toBe('Carlos da Silva');
      }

      const naoEncontrada = await buscarViagemPorId('inexistente');
      expect(naoEncontrada).toEqual({ ok: false, mensagem: 'Viagem não encontrada.' });
    });

    it('buscarUltimoHodometro retorna o maior hodômetro final do veículo', async () => {
      banco.db
        .insert(schema.viagem)
        .values({
          id: 'v-encerrada',
          veiculo_id: VEICULO_ID,
          rota_id: ROTA_ID,
          motorista_id: MOTORISTA_ID,
          hodometro_inicial: 10000,
          hodometro_final: 15430,
          status: 'Finalizada',
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();

      const resultado = await buscarUltimoHodometro(VEICULO_ID);
      expect(resultado).toEqual({ ok: true, data: 15430 });
    });

    it('buscarUltimoHodometro retorna null quando veículo nunca teve viagem encerrada', async () => {
      const resultado = await buscarUltimoHodometro(VEICULO_ID);
      expect(resultado).toEqual({ ok: true, data: null });
    });

    it('buscarViagemEmAndamento retorna a viagem aberta ou null se disponível', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const emAndamento = await buscarViagemEmAndamento(VEICULO_ID);
      expect(emAndamento.ok).toBe(true);
      if (emAndamento.ok) {
        expect(emAndamento.data?.id).toBe(VIAGEM_ID);
      }

      const livre = await buscarViagemEmAndamento(VEICULO_MANUTENCAO_ID);
      expect(livre).toEqual({ ok: true, data: null });
    });

    it('listarViagens aplica filtros de status, veículo e motorista', async () => {
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const resultado = await listarViagens({
        status: 'EmAndamento',
        veiculo_id: VEICULO_ID,
        motorista_id: MOTORISTA_ID,
      });

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.data).toHaveLength(1);
        expect(resultado.data[0]?.id).toBe(VIAGEM_ID);
        expect(resultado.data[0]?.veiculo?.placa).toBe('ABC1D23');
        expect(resultado.data[0]?.em_revisao).toBe(false);
      }

      const vazio = await listarViagens({ status: 'Finalizada' });
      expect(vazio.ok).toBe(true);
      if (vazio.ok) {
        expect(vazio.data).toHaveLength(0);
      }
    });

    it('listarVeiculosParaViagem exclui manutenção, inativos e veículos com viagem aberta', async () => {
      const antes = await listarVeiculosParaViagem();
      expect(antes.ok).toBe(true);
      if (antes.ok) {
        expect(antes.data.map((item) => item.id)).toEqual([VEICULO_ID]);
      }

      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });

      const depois = await listarVeiculosParaViagem();
      expect(depois.ok).toBe(true);
      if (depois.ok) expect(depois.data).toHaveLength(0);
    });

    it('buscarVeiculoParaViagem devolve erro quando o cache não tem o veículo', async () => {
      const encontrado = await buscarVeiculoParaViagem(VEICULO_ID);
      expect(encontrado.ok).toBe(true);

      const ausente = await buscarVeiculoParaViagem('nao-existe');
      expect(ausente.ok).toBe(false);
    });

    it('listarRotasParaViagem devolve apenas rotas ativas', async () => {
      banco.db
        .insert(schema.rota)
        .values({
          id: 'rota-inativa',
          cidade_origem: 'Recife',
          cidade_destino: 'Natal',
          uf_origem: 'PE',
          uf_destino: 'RN',
          distancia_estimada_km: 300,
          ativa: false,
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();

      const resultado = await listarRotasParaViagem();
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.data.map((item) => item.id)).toEqual([ROTA_ID]);
      }
    });

    it('listarMotoristasParaViagem coloca o usuário logado primeiro e só ativos', async () => {
      banco.db
        .insert(schema.usuarioCache)
        .values({
          id: 'motorista-bloqueado',
          nome: 'Motorista Bloqueado',
          email: null,
          status: 'Bloqueado',
          perfil: 'Motorista',
          data_atualizacao: AGORA,
        })
        .run();

      const resultado = await listarMotoristasParaViagem({
        id: OUTRO_MOTORISTA_ID,
        nome: 'Ana Souza',
        email: 'ana@transportadora.com',
      });

      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.data.map((item) => item.id)).toEqual([OUTRO_MOTORISTA_ID, MOTORISTA_ID]);
      }
    });

    it('viagensRepository implementa o contrato ViagensRepository', () => {
      const repo: ViagensRepository = viagensRepository;
      expect(repo.listarViagens).toBe(listarViagens);
      expect(repo.buscarViagemPorId).toBe(buscarViagemPorId);
      expect(repo.buscarUltimoHodometro).toBe(buscarUltimoHodometro);
      expect(repo.buscarViagemEmAndamento).toBe(buscarViagemEmAndamento);
      expect(repo.abrirViagem).toBe(abrirViagem);
      expect(repo.fecharViagem).toBe(fecharViagem);
      expect(repo.cancelarViagem).toBe(cancelarViagem);
      expect(repo.corrigirHodometroFinal).toBe(corrigirHodometroFinal);
    });
  });

  describe('Ciclo de vida do cache local e isolamento de conta', () => {
    let banco: BancoDeTeste;

    beforeEach(() => {
      banco = criarBancoDeTeste();
      setDb(banco.db as unknown as ViagensDb);
      definirUsuarioLocal(null);
    });

    afterEach(() => {
      definirUsuarioLocal(null);
      banco.fechar();
    });

    function semearMinimo(): void {
      banco.db
        .insert(schema.veiculo)
        .values({
          id: VEICULO_ID,
          placa: 'ABC1D23',
          marca: 'Scania',
          modelo: 'R450',
          capacidade_carga: 30,
          status: 'Disponivel',
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();
      banco.db
        .insert(schema.rota)
        .values({
          id: ROTA_ID,
          cidade_origem: 'Recife',
          cidade_destino: 'Salvador',
          uf_origem: 'PE',
          uf_destino: 'BA',
          distancia_estimada_km: 800,
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();
      banco.db
        .insert(schema.usuarioCache)
        .values({
          id: MOTORISTA_ID,
          nome: 'Carlos da Silva',
          email: 'carlos@transportadora.com',
          status: 'Ativo',
          perfil: 'Motorista',
          data_atualizacao: AGORA,
        })
        .run();
    }

    it('prepararSessaoLocal adota outbox legada sem dono na primeira conta', async () => {
      banco.db
        .insert(schema.outbox)
        .values({
          id: 'outbox-legada',
          usuario_id: '',
          entidade: 'viagem',
          operacao: 'insert',
          payload: JSON.stringify({ id: VIAGEM_ID }),
          status: 'pendente',
          tentativas: 0,
          criado_em: AGORA,
        })
        .run();

      const resultado = await prepararSessaoLocal(USUARIO_LOGADO);
      expect(resultado.ok).toBe(true);

      const item = banco.db.select().from(schema.outbox).get();
      expect(item?.usuario_id).toBe(USUARIO_LOGADO);
      const meta = banco.db.select().from(schema.syncMeta).get();
      expect(meta).toEqual({ chave: 'cache_owner', valor: USUARIO_LOGADO });
    });

    it('logout preserva a outbox e as viagens pendentes, mas limpa o cache não pendente', async () => {
      semearMinimo();
      definirUsuarioLocal(USUARIO_LOGADO);
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });
      await prepararSessaoLocal(USUARIO_LOGADO);

      // Uma viagem já sincronizada (sem outbox) não deve sobreviver ao logout.
      banco.db
        .insert(schema.viagem)
        .values({
          id: 'viagem-sincronizada',
          veiculo_id: VEICULO_ID,
          rota_id: ROTA_ID,
          motorista_id: MOTORISTA_ID,
          hodometro_inicial: 1000,
          status: 'Finalizada',
          data_inclusao: AGORA,
          data_atualizacao: AGORA,
        })
        .run();

      const resultado = await limparCacheLocalNoLogout(USUARIO_LOGADO);
      expect(resultado.ok).toBe(true);

      const viagens = banco.db.select().from(schema.viagem).all();
      expect(viagens.map((item) => item.id)).toEqual([VIAGEM_ID]);
      expect(banco.db.select().from(schema.outbox).all()).toHaveLength(1);
      expect(banco.db.select().from(schema.usuarioCache).all()).toHaveLength(0);
      const meta = banco.db.select().from(schema.syncMeta).get();
      expect(meta?.valor).toBe('');
    });

    it('prepararSessaoLocal com outra conta não deixa vazar dados da conta anterior', async () => {
      semearMinimo();
      definirUsuarioLocal(USUARIO_LOGADO);
      await abrirViagem({
        id: VIAGEM_ID,
        veiculo_id: VEICULO_ID,
        rota_id: ROTA_ID,
        motorista_id: MOTORISTA_ID,
        hodometro_inicial: 10000,
      });
      await prepararSessaoLocal(USUARIO_LOGADO);

      definirUsuarioLocal('outra-conta');
      const resultado = await prepararSessaoLocal('outra-conta');
      expect(resultado.ok).toBe(true);

      expect(banco.db.select().from(schema.viagem).all()).toHaveLength(0);
      expect(banco.db.select().from(schema.veiculo).all()).toHaveLength(0);
      expect(banco.db.select().from(schema.rota).all()).toHaveLength(0);
      expect(banco.db.select().from(schema.usuarioCache).all()).toHaveLength(0);

      // A operação ainda não sincronizada da conta anterior continua na outbox.
      const outbox = banco.db.select().from(schema.outbox).all();
      expect(outbox).toHaveLength(1);
      expect(outbox[0]?.usuario_id).toBe(USUARIO_LOGADO);
    });

    it('setDb troca a instância usada pelo repositório', () => {
      expect(getDb()).toBe(banco.db);
    });
  });
});
