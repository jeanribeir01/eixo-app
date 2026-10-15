/** @jest-environment node */
// Testes da migration 20261014000300_manutencao_rpc.sql — EIX-75 (banco da US06-b, EIX-39).
// As RPCs gravam em `manutencao`, `movimentacao` e `veiculo`; cada teste confere as tabelas
// depois da chamada, não só o retorno, porque o critério é sobre o que fica gravado.

import type { Transaction } from '@electric-sql/pglite';

import { criarBanco, comoAnonimo, comoSuperuser, comoUsuario, type Banco, type PerfilNome } from './helpers/db';

const GESTOR = { id: '75100000-0000-0000-0000-000000000001', perfil: 'Gestor de Frota' as const };
const ADMIN = { id: '75100000-0000-0000-0000-000000000002', perfil: 'Admin' as const };

type DadosManutencao = {
  veiculoId?: string;
  descricao?: string;
  dataManutencao?: string;
  // Em reais, como a coluna `numeric(12,2)` guarda.
  valor?: string;
  formaPagamentoId?: string;
  statusPagamento?: 'Pago' | 'Pendente';
};

type Contagens = { manutencoes: number; movimentacoes: number };

// O erro do PGlite traz o SQLSTATE em `code`; é ele que o app traduz em mensagem.
async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration manutencao_rpc', () => {
  let db: Banco;
  let categoriaManutencao: string;
  let formaPix: string;
  let formaInativa: string;
  let placas = 0;

  beforeAll(async () => {
    db = await criarBanco();

    const categoria = await db.query<{ id: string }>(
      `select id from categoria where titulo = 'Manutenção' and tipo = 'Saida'`,
    );
    categoriaManutencao = categoria.rows[0]!.id;
    const pix = await db.query<{ id: string }>(`select id from forma_pagamento where nome = 'Pix'`);
    formaPix = pix.rows[0]!.id;
    const inativa = await db.query<{ id: string }>(
      `insert into forma_pagamento (nome, ativa) values ('Cheque', false) returning id`,
    );
    formaInativa = inativa.rows[0]!.id;
  });

  beforeEach(async () => {
    await db.query('delete from manutencao');
    await db.query('delete from movimentacao');
  });

  afterAll(async () => {
    await db.close();
  });

  // Veículo próprio por teste: o status muda a cada chamada da RPC.
  async function criarVeiculo(status: 'Disponivel' | 'EmViagem' | 'EmManutencao' | 'Inativo' = 'Disponivel') {
    placas += 1;
    const resultado = await db.query<{ id: string }>(
      `insert into veiculo (placa, marca, modelo, capacidade_carga, status)
       values ($1, 'Volvo', 'FH', 10000, $2) returning id`,
      [`MNT${String(placas).padStart(4, '0')}`, status],
    );
    return resultado.rows[0]!.id;
  }

  // Datas relativas ao "hoje" de São Paulo, o mesmo que o trigger usa.
  async function diaRelativo(dias: number): Promise<string> {
    const resultado = await db.query<{ dia: string }>(
      `select ((now() at time zone 'America/Sao_Paulo')::date + $1::int)::text as dia`,
      [dias],
    );
    return resultado.rows[0]!.dia;
  }

  function chamarRegistrar(tx: Transaction, veiculoId: string, dados: DadosManutencao = {}) {
    return tx.query<{ id: string }>(
      `select registrar_manutencao(
         veiculo_id => $1,
         descricao => $2,
         data_manutencao => $3::date,
         valor => $4::numeric,
         forma_pagamento_id => $5,
         status_pagamento => $6::status_pagamento
       ) as id`,
      [
        veiculoId,
        dados.descricao ?? 'Troca de pneus',
        dados.dataManutencao ?? '2026-10-01',
        dados.valor ?? '3200.00',
        dados.formaPagamentoId ?? formaPix,
        dados.statusPagamento ?? 'Pago',
      ],
    );
  }

  async function registrarComo(
    usuario: typeof GESTOR | typeof ADMIN,
    veiculoId: string,
    dados: DadosManutencao = {},
  ): Promise<string> {
    const resultado = await comoUsuario(db, usuario, (tx) => chamarRegistrar(tx, veiculoId, dados));
    return resultado.rows[0]!.id;
  }

  function chamarConcluir(tx: Transaction, id: string) {
    return tx.query<{ status: string }>('select concluir_manutencao(id => $1) as status', [id]);
  }

  async function statusDoVeiculo(veiculoId: string): Promise<string> {
    const resultado = await db.query<{ status: string }>('select status from veiculo where id = $1', [veiculoId]);
    return resultado.rows[0]!.status;
  }

  async function contagens(): Promise<Contagens> {
    const manutencoes = await db.query<{ n: number }>('select count(*)::int as n from manutencao');
    const movimentacoes = await db.query<{ n: number }>('select count(*)::int as n from movimentacao');
    return { manutencoes: manutencoes.rows[0]!.n, movimentacoes: movimentacoes.rows[0]!.n };
  }

  describe('registrar manutenção', () => {
    it('grava a manutenção e devolve o id', async () => {
      const veiculoId = await criarVeiculo();

      const id = await registrarComo(GESTOR, veiculoId);

      const manutencao = await db.query(
        `select veiculo_id, descricao, data_manutencao::text as data_manutencao, valor::text as valor,
                data_conclusao
         from manutencao where id = $1`,
        [id],
      );
      expect(manutencao.rows).toEqual([
        {
          veiculo_id: veiculoId,
          descricao: 'Troca de pneus',
          data_manutencao: '2026-10-01',
          valor: '3200.00',
          data_conclusao: null,
        },
      ]);
    });

    it('cria a despesa Paga na categoria Manutenção, ligada à manutenção, com a data do serviço', async () => {
      const veiculoId = await criarVeiculo();
      const placa = (await db.query<{ placa: string }>('select placa from veiculo where id = $1', [veiculoId])).rows[0]!
        .placa;

      const id = await registrarComo(GESTOR, veiculoId, { valor: '1250.50', dataManutencao: '2026-09-20' });

      const despesa = await db.query(
        `select m.categoria_id, m.forma_pagamento_id, m.valor::text as valor, m.descricao,
                m.data_vencimento::text as data_vencimento, m.data_pagamento::text as data_pagamento,
                m.status_pagamento, m.viagem_id, m.divida_id
         from manutencao ma join movimentacao m on m.id = ma.movimentacao_id
         where ma.id = $1`,
        [id],
      );
      expect(despesa.rows).toEqual([
        {
          categoria_id: categoriaManutencao,
          forma_pagamento_id: formaPix,
          valor: '1250.50',
          descricao: `Manutenção ${placa}: Troca de pneus`,
          data_vencimento: '2026-09-20',
          data_pagamento: '2026-09-20',
          status_pagamento: 'Pago',
          viagem_id: null,
          divida_id: null,
        },
      ]);
      expect(await contagens()).toEqual({ manutencoes: 1, movimentacoes: 1 });
    });

    it('com Pendente, a despesa fica Pendente e sem data de pagamento', async () => {
      const veiculoId = await criarVeiculo();

      const id = await registrarComo(GESTOR, veiculoId, { statusPagamento: 'Pendente' });

      const despesa = await db.query(
        `select m.status_pagamento, m.data_pagamento
         from manutencao ma join movimentacao m on m.id = ma.movimentacao_id where ma.id = $1`,
        [id],
      );
      expect(despesa.rows).toEqual([{ status_pagamento: 'Pendente', data_pagamento: null }]);
    });

    it('a despesa é de Saída', async () => {
      const veiculoId = await criarVeiculo();

      const id = await registrarComo(ADMIN, veiculoId);

      const tipo = await db.query<{ tipo: string }>(
        `select c.tipo from manutencao ma
         join movimentacao m on m.id = ma.movimentacao_id
         join categoria c on c.id = m.categoria_id
         where ma.id = $1`,
        [id],
      );
      expect(tipo.rows).toEqual([{ tipo: 'Saida' }]);
    });

    it.each(['Disponivel', 'EmManutencao'] as const)('veículo %s vai para EmManutencao', async (status) => {
      const veiculoId = await criarVeiculo(status);

      await registrarComo(GESTOR, veiculoId);

      expect(await statusDoVeiculo(veiculoId)).toBe('EmManutencao');
    });

    it('aceita manutenção com data de hoje (São Paulo)', async () => {
      const veiculoId = await criarVeiculo();
      const hoje = await diaRelativo(0);

      const id = await registrarComo(GESTOR, veiculoId, { dataManutencao: hoje });

      expect(id).toBeDefined();
    });
  });

  describe('rollback', () => {
    it('se a despesa falha, nem a manutenção é gravada nem o veículo muda de status', async () => {
      // Trigger de teste: derruba o insert da movimentação gerada pela manutenção.
      await comoSuperuser(db, async (tx) => {
        await tx.query(`
          create function falha_na_despesa_da_manutencao() returns trigger language plpgsql as $$
          begin
            if new.descricao like 'Manutenção %' then
              raise exception 'falha simulada na despesa';
            end if;
            return new;
          end;
          $$`);
        await tx.query(`
          create trigger falha_na_despesa_da_manutencao before insert on movimentacao
          for each row execute function falha_na_despesa_da_manutencao()`);
      });

      try {
        const veiculoId = await criarVeiculo();

        const codigo = await codigoDoErro(comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId)));

        expect(codigo).toBe('P0001');
        expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
        expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
      } finally {
        await db.query('drop trigger falha_na_despesa_da_manutencao on movimentacao');
        await db.query('drop function falha_na_despesa_da_manutencao()');
      }
    });

    it('se a manutenção falha depois da despesa inserida, a despesa é desfeita', async () => {
      // Data futura passa pela movimentacao (que não valida data) e só é barrada pelo trigger
      // de manutencao, que roda depois: prova o rollback no sentido inverso.
      const veiculoId = await criarVeiculo();
      const amanha = await diaRelativo(1);

      const codigo = await codigoDoErro(
        comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId, { dataManutencao: amanha })),
      );

      expect(codigo).toBe('23514');
      expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
      expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
    });
  });

  describe('bloqueios', () => {
    it('veículo em viagem recebe MN001 e nada é gravado', async () => {
      const veiculoId = await criarVeiculo('EmViagem');

      const codigo = await codigoDoErro(comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId)));

      expect(codigo).toBe('MN001');
      expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
      expect(await statusDoVeiculo(veiculoId)).toBe('EmViagem');
    });

    it('veículo inativo recebe MN002 e nada é gravado', async () => {
      const veiculoId = await criarVeiculo('Inativo');

      const codigo = await codigoDoErro(comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId)));

      expect(codigo).toBe('MN002');
      expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
      expect(await statusDoVeiculo(veiculoId)).toBe('Inativo');
    });

    it('veículo inexistente recebe P0002', async () => {
      const codigo = await codigoDoErro(
        comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, '00000000-0000-0000-0000-0000000000ff')),
      );

      expect(codigo).toBe('P0002');
    });

    it.each(['0', '0.00', '-150.00'])('valor %s recebe 23514 e nada é gravado', async (valor) => {
      const veiculoId = await criarVeiculo();

      const codigo = await codigoDoErro(comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId, { valor })));

      expect(codigo).toBe('23514');
      expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
      expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
    });

    it('valor 0 recebe 23514 também fora da RPC (check na tabela)', async () => {
      // Pela RPC, a check de movimentacao já barraria o zero; aqui prova a de manutencao.
      const veiculoId = await criarVeiculo();

      const codigo = await codigoDoErro(
        db.query(
          `insert into manutencao (veiculo_id, descricao, data_manutencao, valor) values ($1, 'Revisão', '2026-10-01', 0)`,
          [veiculoId],
        ),
      );

      expect(codigo).toBe('23514');
    });

    it('aceita o menor valor positivo (R$ 0,01)', async () => {
      const veiculoId = await criarVeiculo();

      await expect(registrarComo(GESTOR, veiculoId, { valor: '0.01' })).resolves.toBeDefined();
    });

    it('data futura recebe 23514 também fora da RPC (trigger na tabela)', async () => {
      const veiculoId = await criarVeiculo();
      const amanha = await diaRelativo(1);

      const codigo = await codigoDoErro(
        db.query(
          `insert into manutencao (veiculo_id, descricao, data_manutencao, valor) values ($1, 'Revisão', $2, 100)`,
          [veiculoId, amanha],
        ),
      );

      expect(codigo).toBe('23514');
    });

    it('forma de pagamento inativa ou inexistente recebe 22023', async () => {
      const veiculoId = await criarVeiculo();

      for (const formaPagamentoId of [formaInativa, '00000000-0000-0000-0000-0000000000fe']) {
        const codigo = await codigoDoErro(
          comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId, { formaPagamentoId })),
        );
        expect(codigo).toBe('22023');
      }
      expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
    });

    it('categoria Manutenção inativa recebe MN003', async () => {
      const veiculoId = await criarVeiculo();
      await db.query('update categoria set ativa = false where id = $1', [categoriaManutencao]);

      try {
        const codigo = await codigoDoErro(comoUsuario(db, GESTOR, (tx) => chamarRegistrar(tx, veiculoId)));

        expect(codigo).toBe('MN003');
        expect(await contagens()).toEqual({ manutencoes: 0, movimentacoes: 0 });
      } finally {
        await db.query('update categoria set ativa = true where id = $1', [categoriaManutencao]);
      }
    });
  });

  describe('concluir manutenção', () => {
    it('grava a data de conclusão e devolve o veículo para Disponivel', async () => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId);

      const resposta = await comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, id));

      expect(resposta.rows[0]!.status).toBe('Disponivel');
      expect(await statusDoVeiculo(veiculoId)).toBe('Disponivel');
      const manutencao = await db.query<{ concluida: boolean }>(
        'select data_conclusao is not null as concluida from manutencao where id = $1',
        [id],
      );
      expect(manutencao.rows).toEqual([{ concluida: true }]);
    });

    it('com outra manutenção aberta no mesmo veículo, ele continua EmManutencao até a última', async () => {
      const veiculoId = await criarVeiculo();
      const pneus = await registrarComo(GESTOR, veiculoId, { descricao: 'Pneus' });
      const freio = await registrarComo(GESTOR, veiculoId, { descricao: 'Freio' });

      const primeira = await comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, pneus));
      expect(primeira.rows[0]!.status).toBe('EmManutencao');
      expect(await statusDoVeiculo(veiculoId)).toBe('EmManutencao');

      const segunda = await comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, freio));
      expect(segunda.rows[0]!.status).toBe('Disponivel');
    });

    it('veículo inativado durante a manutenção continua Inativo ao concluir', async () => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId);
      await db.query(`update veiculo set status = 'Inativo' where id = $1`, [veiculoId]);

      const resposta = await comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, id));

      expect(resposta.rows[0]!.status).toBe('Inativo');
    });

    it('concluir duas vezes ou uma manutenção inexistente recebe P0002', async () => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId);
      await comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, id));

      const jaConcluida = await codigoDoErro(comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, id)));
      const inexistente = await codigoDoErro(
        comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, '00000000-0000-0000-0000-0000000000fd')),
      );

      expect(jaConcluida).toBe('P0002');
      expect(inexistente).toBe('P0002');
    });

    it('não mexe na despesa já gerada', async () => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId, { statusPagamento: 'Pendente' });

      await comoUsuario(db, GESTOR, (tx) => chamarConcluir(tx, id));

      const despesa = await db.query(
        `select m.status_pagamento, m.valor::text as valor
         from manutencao ma join movimentacao m on m.id = ma.movimentacao_id where ma.id = $1`,
        [id],
      );
      expect(despesa.rows).toEqual([{ status_pagamento: 'Pendente', valor: '3200.00' }]);
    });
  });

  describe('acesso restrito', () => {
    it.each([
      ['Financeiro', '75100000-0000-0000-0000-000000000011'],
      ['Motorista', '75100000-0000-0000-0000-000000000012'],
    ] as [PerfilNome, string][])('%s recebe 42501 nas duas RPCs', async (perfil, usuarioId) => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId);

      const registrar = await codigoDoErro(
        comoUsuario(db, { id: usuarioId, perfil }, (tx) => chamarRegistrar(tx, veiculoId)),
      );
      const concluir = await codigoDoErro(comoUsuario(db, { id: usuarioId, perfil }, (tx) => chamarConcluir(tx, id)));

      expect(registrar).toBe('42501');
      expect(concluir).toBe('42501');
      expect(await contagens()).toEqual({ manutencoes: 1, movimentacoes: 1 });
      expect(await statusDoVeiculo(veiculoId)).toBe('EmManutencao');
    });

    it('Gestor de Frota com status Bloqueado recebe 42501', async () => {
      const veiculoId = await criarVeiculo();
      const bloqueado = { id: '75100000-0000-0000-0000-000000000021', perfil: 'Gestor de Frota' as const, status: 'Bloqueado' as const };

      const codigo = await codigoDoErro(comoUsuario(db, bloqueado, (tx) => chamarRegistrar(tx, veiculoId)));

      expect(codigo).toBe('42501');
    });

    it('anon não tem permissão de execute nas duas RPCs; authenticated tem', async () => {
      const privilegios = await db.query<{ anon: boolean; authenticated: boolean }>(
        `select has_function_privilege('anon', f, 'execute') as anon,
                has_function_privilege('authenticated', f, 'execute') as authenticated
         from unnest(array[
           'registrar_manutencao(uuid, text, date, numeric, uuid, status_pagamento)',
           'concluir_manutencao(uuid)'
         ]) as f`,
      );

      expect(privilegios.rows).toEqual([
        { anon: false, authenticated: true },
        { anon: false, authenticated: true },
      ]);
    });

    it('anon recebe 42501 nas duas RPCs', async () => {
      const veiculoId = await criarVeiculo();

      const registrar = await codigoDoErro(comoAnonimo(db, (tx) => chamarRegistrar(tx, veiculoId)));
      const concluir = await codigoDoErro(
        comoAnonimo(db, (tx) => tx.query('select concluir_manutencao(id => $1)', ['00000000-0000-0000-0000-0000000000fd'])),
      );

      expect(registrar).toBe('42501');
      expect(concluir).toBe('42501');
    });

    it('Admin e Gestor não gravam, alteram nem apagam manutencao direto pela tabela', async () => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId);

      for (const usuario of [ADMIN, GESTOR]) {
        const insert = await codigoDoErro(
          comoUsuario(db, usuario, (tx) =>
            tx.query(
              `insert into manutencao (veiculo_id, descricao, data_manutencao, valor)
               values ($1, 'Sem despesa', current_date, 100)`,
              [veiculoId],
            ),
          ),
        );
        const update = await comoUsuario(db, usuario, (tx) =>
          tx.query('update manutencao set valor = 1 where id = $1 returning id', [id]),
        );
        const remocao = await comoUsuario(db, usuario, (tx) =>
          tx.query('delete from manutencao where id = $1 returning id', [id]),
        );

        expect(insert).toBe('42501');
        expect(update.rows).toHaveLength(0);
        expect(remocao.rows).toHaveLength(0);
      }

      const manutencao = await db.query<{ valor: string }>('select valor::text as valor from manutencao where id = $1', [id]);
      expect(manutencao.rows).toEqual([{ valor: '3200.00' }]);
    });

    it('Admin e Gestor continuam lendo manutencao', async () => {
      const veiculoId = await criarVeiculo();
      const id = await registrarComo(GESTOR, veiculoId);

      for (const usuario of [ADMIN, GESTOR]) {
        const linhas = await comoUsuario(db, usuario, (tx) => tx.query<{ id: string }>('select id from manutencao'));
        expect(linhas.rows.map((linha) => linha.id)).toEqual([id]);
      }
    });

    it('só restou a policy de leitura em manutencao', async () => {
      const policies = await db.query<{ policyname: string }>(
        `select policyname from pg_policies where tablename = 'manutencao' order by policyname`,
      );

      expect(policies.rows.map((linha) => linha.policyname)).toEqual(['manutencao_select']);
    });
  });
});
