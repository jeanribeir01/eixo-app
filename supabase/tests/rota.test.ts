/** @jest-environment node */
// Testes das migrations 20261014000200_rota_uf_ativa.sql e 20261014000400_rota_trecho_sem_acento.sql
// — EIX-75 (banco da US07, EIX-38): UF restrita às 27, rota duplicada bloqueada (inclusive com
// caixa, espaço ou acento diferente), soft delete com `ativa` e delete físico rejeitado para
// todos os perfis.

import { aplicarMigration, criarBanco, comoSuperuser, comoUsuario, type Banco, type PerfilNome } from './helpers/db';

const GESTOR = { id: '75000000-0000-0000-0000-000000000001', perfil: 'Gestor de Frota' as const };

type DadosRota = {
  cidadeOrigem?: string;
  ufOrigem?: string;
  cidadeDestino?: string;
  ufDestino?: string;
};

// O erro do PGlite traz o SQLSTATE em `code`; é ele que o app traduz em mensagem.
async function codigoDoErro(promessa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promessa;
    return undefined;
  } catch (erro) {
    return (erro as { code?: string }).code;
  }
}

describe('migration rota_uf_ativa', () => {
  let db: Banco;

  beforeAll(async () => {
    db = await criarBanco();
  });

  beforeEach(async () => {
    await db.query('delete from rota');
  });

  afterAll(async () => {
    await db.close();
  });

  function inserirRota(dados: DadosRota = {}) {
    return db.query<{ id: string }>(
      `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
       values ($1, $2::uf, $3, $4::uf, 400) returning id`,
      [
        dados.cidadeOrigem ?? 'São Paulo',
        dados.ufOrigem ?? 'SP',
        dados.cidadeDestino ?? 'Curitiba',
        dados.ufDestino ?? 'PR',
      ],
    );
  }

  describe('UF', () => {
    it('o enum uf tem exatamente as 27 UFs', async () => {
      const resultado = await db.query<{ ufs: string[] }>(`select enum_range(null::uf)::text[] as ufs`);

      expect(resultado.rows[0]!.ufs).toEqual([
        'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
        'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
      ]);
    });

    it('grava a rota com as UFs e ativa por padrão', async () => {
      const { rows } = await inserirRota();

      const rota = await db.query<{ uf_origem: string; uf_destino: string; ativa: boolean }>(
        'select uf_origem, uf_destino, ativa from rota where id = $1',
        [rows[0]!.id],
      );
      expect(rota.rows).toEqual([{ uf_origem: 'SP', uf_destino: 'PR', ativa: true }]);
    });

    it.each([
      ['inexistente', 'XX'],
      ['minúscula', 'sp'],
      ['nome por extenso', 'São Paulo'],
      ['vazia', ''],
    ])('rejeita UF %s com 22P02', async (_caso, uf) => {
      expect(await codigoDoErro(inserirRota({ ufOrigem: uf }))).toBe('22P02');
      expect(await codigoDoErro(inserirRota({ ufDestino: uf }))).toBe('22P02');
    });

    it('rejeita rota sem UF de origem ou de destino com 23502', async () => {
      const semOrigem = codigoDoErro(
        db.query(
          `insert into rota (cidade_origem, cidade_destino, uf_destino, distancia_estimada_km)
           values ('São Paulo', 'Curitiba', 'PR', 400)`,
        ),
      );
      const semDestino = codigoDoErro(
        db.query(
          `insert into rota (cidade_origem, uf_origem, cidade_destino, distancia_estimada_km)
           values ('São Paulo', 'SP', 'Curitiba', 400)`,
        ),
      );

      expect(await semOrigem).toBe('23502');
      expect(await semDestino).toBe('23502');
    });
  });

  describe('rota duplicada', () => {
    it('rejeita a mesma origem e destino com 23505', async () => {
      await inserirRota();

      expect(await codigoDoErro(inserirRota())).toBe('23505');
    });

    it('rejeita a mesma rota escrita com outra caixa com 23505', async () => {
      await inserirRota({ cidadeOrigem: 'São Paulo', cidadeDestino: 'Curitiba' });

      expect(await codigoDoErro(inserirRota({ cidadeOrigem: 'são paulo', cidadeDestino: 'CURITIBA' }))).toBe('23505');
    });

    it.each([
      ['sem acento', 'Sao Paulo', 'Curitiba'],
      ['em maiúsculas com acento', 'SÃO PAULO', 'CURITIBA'],
      ['com acento a mais', 'São Paulo', 'Curitibá'],
    ])('rejeita a mesma rota escrita %s com 23505', async (_caso, cidadeOrigem, cidadeDestino) => {
      await inserirRota({ cidadeOrigem: 'São Paulo', cidadeDestino: 'Curitiba' });

      expect(await codigoDoErro(inserirRota({ cidadeOrigem, cidadeDestino }))).toBe('23505');
    });

    it('ç e ñ contam como c e n (Foz do Iguaçu = Foz do Iguacu)', async () => {
      await inserirRota({ cidadeDestino: 'Foz do Iguaçu' });

      expect(await codigoDoErro(inserirRota({ cidadeDestino: 'FOZ DO IGUACU' }))).toBe('23505');
    });

    it('normaliza_cidade tira acento e caixa de todas as vogais acentuadas', async () => {
      const resultado = await db.query<{ normalizada: string }>(
        `select normaliza_cidade('ÁÀÂÃÄ ÉÈÊË ÍÌÎÏ ÓÒÔÕÖ ÚÙÛÜ Ç Ñ áàâãä éèêë íìîï óòôõö úùûü ç ñ') as normalizada`,
      );

      expect(resultado.rows[0]!.normalizada).toBe(
        'aaaaa eeee iiii ooooo uuuu c n aaaaa eeee iiii ooooo uuuu c n',
      );
    });

    it('cidades diferentes continuam diferentes depois de tirar o acento', async () => {
      await inserirRota({ cidadeDestino: 'Curitiba' });

      await expect(inserirRota({ cidadeDestino: 'Curitibanos', ufDestino: 'SC' })).resolves.toBeDefined();
      await expect(inserirRota({ cidadeDestino: 'Curitibanos' })).resolves.toBeDefined();
    });

    it('rejeita cidade com espaço sobrando com 23514 (o cliente normaliza antes de enviar)', async () => {
      await inserirRota();

      for (const cidade of ['curitiba ', ' Curitiba', 'Curi  tiba', '']) {
        expect(await codigoDoErro(inserirRota({ cidadeDestino: cidade }))).toBe('23514');
        expect(await codigoDoErro(inserirRota({ cidadeOrigem: cidade }))).toBe('23514');
      }
      const total = await db.query<{ n: number }>('select count(*)::int as n from rota');
      expect(total.rows[0]!.n).toBe(1);
    });

    it('a mesma cidade em outra UF é outra rota', async () => {
      await inserirRota({ cidadeDestino: 'Bom Jesus', ufDestino: 'RS' });

      await expect(inserirRota({ cidadeDestino: 'Bom Jesus', ufDestino: 'PI' })).resolves.toBeDefined();
    });

    it('o sentido importa: ida e volta são duas rotas', async () => {
      await inserirRota({ cidadeOrigem: 'São Paulo', ufOrigem: 'SP', cidadeDestino: 'Curitiba', ufDestino: 'PR' });

      await expect(
        inserirRota({ cidadeOrigem: 'Curitiba', ufOrigem: 'PR', cidadeDestino: 'São Paulo', ufDestino: 'SP' }),
      ).resolves.toBeDefined();
    });

    it('rota inativa continua bloqueando a duplicada (o usuário reativa a antiga)', async () => {
      const { rows } = await inserirRota();
      await db.query('update rota set ativa = false where id = $1', [rows[0]!.id]);

      expect(await codigoDoErro(inserirRota())).toBe('23505');
    });

    it('editar uma rota para virar cópia de outra também é rejeitado', async () => {
      await inserirRota({ cidadeDestino: 'Curitiba' });
      const { rows } = await inserirRota({ cidadeDestino: 'Joinville', ufDestino: 'SC' });

      const codigo = await codigoDoErro(
        db.query(`update rota set cidade_destino = 'curitiba', uf_destino = 'PR' where id = $1`, [rows[0]!.id]),
      );
      expect(codigo).toBe('23505');
    });
  });

  describe('soft delete', () => {
    it('Admin e Gestor de Frota inativam a rota, mas o delete afeta 0 linhas', async () => {
      const perfis = [
        { id: '75000000-0000-0000-0000-000000000011', perfil: 'Admin' as const },
        { id: '75000000-0000-0000-0000-000000000012', perfil: 'Gestor de Frota' as const },
      ];

      for (const usuario of perfis) {
        await db.query('delete from rota');
        const { rows } = await inserirRota();
        const rotaId = rows[0]!.id;

        await comoUsuario(db, usuario, async (tx) => {
          const inativada = await tx.query<{ ativa: boolean }>(
            'update rota set ativa = false where id = $1 returning ativa',
            [rotaId],
          );
          expect(inativada.rows).toEqual([{ ativa: false }]);

          const remocao = await tx.query('delete from rota where id = $1 returning id', [rotaId]);
          expect(remocao.rows).toHaveLength(0);
        });

        const aindaExiste = await db.query('select id from rota where id = $1', [rotaId]);
        expect(aindaExiste.rows).toHaveLength(1);
      }
    });

    it.each(['Financeiro', 'Motorista'] as PerfilNome[])('%s não apaga rota (0 linhas)', async (perfil) => {
      const { rows } = await inserirRota();

      const remocao = await comoUsuario(db, { id: '75000000-0000-0000-0000-000000000013', perfil }, (tx) =>
        tx.query('delete from rota where id = $1 returning id', [rows[0]!.id]),
      );

      expect(remocao.rows).toHaveLength(0);
    });

    it('a policy rota_delete não existe mais', async () => {
      const policies = await db.query<{ policyname: string }>(
        `select policyname from pg_policies where tablename = 'rota' order by policyname`,
      );

      expect(policies.rows.map((linha) => linha.policyname)).toEqual(['rota_insert', 'rota_select', 'rota_update']);
    });

    it('Gestor de Frota cadastra rota com UF pela API', async () => {
      const resultado = await comoUsuario(db, GESTOR, (tx) =>
        tx.query<{ ativa: boolean }>(
          `insert into rota (cidade_origem, uf_origem, cidade_destino, uf_destino, distancia_estimada_km)
           values ('Campinas', 'SP', 'Belo Horizonte', 'MG', 600) returning ativa`,
        ),
      );

      expect(resultado.rows).toEqual([{ ativa: true }]);
    });
  });

  describe('rotas anteriores à migration', () => {
    it('com rota antiga sem UF, a migration falha inteira e não aplica nada', async () => {
      const antigo = await criarBanco({ antesDe: '20261014000200_rota_uf_ativa.sql' });
      try {
        await comoSuperuser(antigo, (tx) =>
          tx.query(
            `insert into rota (cidade_origem, cidade_destino, distancia_estimada_km)
             values ('São Paulo', 'Curitiba', 400)`,
          ),
        );

        expect(await codigoDoErro(aplicarMigration(antigo, '20261014000200_rota_uf_ativa.sql'))).toBe('23502');

        const colunas = await antigo.query(
          `select column_name from information_schema.columns
           where table_name = 'rota' and column_name in ('uf_origem', 'uf_destino', 'ativa')`,
        );
        expect(colunas.rows).toHaveLength(0);
      } finally {
        await antigo.close();
      }
    });
  });
});
