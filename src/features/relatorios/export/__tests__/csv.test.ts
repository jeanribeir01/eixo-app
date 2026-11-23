import { BOM, gerarCsv, valorCsv } from '../csv';
import type { TransacaoRelatorio } from '../linhas';

function transacao(parcial: Partial<TransacaoRelatorio> = {}): TransacaoRelatorio {
  return {
    id: 'id-1',
    dataReferencia: '2026-11-05',
    descricao: 'Frete Curitiba',
    categoria: 'Frete',
    tipo: 'Entrada',
    valorCentavos: 150000,
    status: 'Pago',
    ...parcial,
  };
}

// Linhas sem o BOM e sem a quebra final, para comparar uma a uma.
function linhas(csv: string): string[] {
  return csv.slice(BOM.length).split('\r\n').slice(0, -1);
}

describe('gerarCsv', () => {
  it('começa com o BOM UTF-8 e o cabeçalho com ";" (EXP-06)', () => {
    const csv = gerarCsv([transacao()]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas(csv)[0]).toBe('Data;Descrição;Categoria;Valor;Status');
  });

  it('separa as linhas com CRLF e termina com CRLF (EXP-06)', () => {
    const csv = gerarCsv([transacao(), transacao({ id: 'id-2' })]);

    expect(csv.endsWith('\r\n')).toBe(true);
    // 3 linhas (cabeçalho + 2) = 3 CRLF, e nenhum LF solto.
    expect(csv.match(/\r\n/g)).toHaveLength(3);
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('mantém os acentos como digitados (EXP-06)', () => {
    const csv = gerarCsv([
      transacao({ descricao: 'Manutenção do câmbio — peça', categoria: 'Manutenção', tipo: 'Saida', status: 'Pendente' }),
    ]);

    expect(linhas(csv)[1]).toBe('05/11/2026;Manutenção do câmbio — peça;Manutenção;-1500,00;Pendente');
  });

  it('monta a linha com Data, Descrição, Categoria, Valor e Status (EXP-05)', () => {
    const csv = gerarCsv([
      transacao({ dataReferencia: '2026-11-30', tipo: 'Entrada', status: 'Pago', valorCentavos: 113 }),
      transacao({ dataReferencia: '2026-11-01', tipo: 'Saida', status: 'Pago', valorCentavos: 99 }),
    ]);

    expect(linhas(csv).slice(1)).toEqual([
      '30/11/2026;Frete Curitiba;Frete;1,13;Recebido',
      '01/11/2026;Frete Curitiba;Frete;-0,99;Pago',
    ]);
  });

  it('põe entre aspas o campo com ";", aspas ou quebra de linha, dobrando a aspa (EXP-08)', () => {
    const csv = gerarCsv([
      transacao({ descricao: 'Pedágio; ida e volta', categoria: 'Taxa "extra"' }),
      transacao({ descricao: 'Linha 1\nLinha 2' }),
      transacao({ descricao: 'Retorno\rcarro' }),
    ]);

    const [, primeira] = linhas(csv);
    expect(primeira).toBe('05/11/2026;"Pedágio; ida e volta";"Taxa ""extra""";1500,00;Recebido');
    expect(csv).toContain(';"Linha 1\nLinha 2";');
    expect(csv).toContain(';"Retorno\rcarro";');
  });

  it.each(['=HYPERLINK("http://x")', '+55 41', '-desconto', '@SOMA(A1)', '\tTab', '\rCR'])(
    'põe apóstrofo na frente do texto que o Excel leria como fórmula: %j (EXP-09)',
    (descricao) => {
      const csv = gerarCsv([transacao({ descricao, categoria: descricao })]);

      // Descrição e categoria começam com o apóstrofo, dentro ou fora das aspas.
      const esperado = descricao.match(/[;"\r\n]/) ? `"'${descricao.replace(/"/g, '""')}"` : `'${descricao}`;
      expect(csv).toContain(`;${esperado};${esperado};`);
    },
  );

  it('não põe apóstrofo em texto comum', () => {
    const csv = gerarCsv([transacao({ descricao: 'Diesel 2=1', categoria: 'Combustível' })]);

    expect(linhas(csv)[1]).toBe('05/11/2026;Diesel 2=1;Combustível;1500,00;Recebido');
  });

  it('sem transações, gera só o cabeçalho (EXP-22)', () => {
    expect(gerarCsv([])).toBe(`${BOM}Data;Descrição;Categoria;Valor;Status\r\n`);
  });
});

describe('valorCsv (EXP-07)', () => {
  it.each([
    [123456, 'Saida', '-1234,56'],
    [123456, 'Entrada', '1234,56'],
    [113, 'Entrada', '1,13'],
    [5, 'Saida', '-0,05'],
    [100000000, 'Entrada', '1000000,00'],
  ] as const)('%i centavos de %s = %s', (valorCentavos, tipo, esperado) => {
    expect(valorCsv({ valorCentavos, tipo })).toBe(esperado);
  });
});
