import type { TransacaoRelatorio } from '../linhas';
import { escaparHtml, gerarHtmlPdf, PAGINA_A4 } from '../pdf';

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

const BASE = { empresa: 'Transportes Silva', periodo: 'novembro 2026', geradoEm: '2026-11-23' };

function linhasDaTabela(html: string): string[] {
  return html.match(/<tr class="linha">.*?<\/tr>/g) ?? [];
}

describe('gerarHtmlPdf', () => {
  it('mostra no cabeçalho o nome da empresa e o período (EXP-10)', () => {
    const html = gerarHtmlPdf({ ...BASE, transacoes: [transacao()] });

    expect(html).toContain('<h1>Transportes Silva</h1>');
    expect(html).toContain('Período: novembro 2026');
  });

  it('monta uma linha por transação com Data, Descrição, Categoria, Valor e Status (EXP-05)', () => {
    const html = gerarHtmlPdf({
      ...BASE,
      transacoes: [
        transacao({ descricao: 'Diesel', categoria: 'Combustível', tipo: 'Saida', valorCentavos: 123456, status: 'Pendente' }),
        transacao({ dataReferencia: '2026-11-30', valorCentavos: 113 }),
      ],
    });

    expect(html).toContain(
      '<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="valor">Valor</th><th>Status</th></tr></thead>',
    );
    expect(linhasDaTabela(html)).toEqual([
      '<tr class="linha"><td>05/11/2026</td><td>Diesel</td><td>Combustível</td><td class="valor">− R$ 1.234,56</td><td>Pendente</td></tr>',
      '<tr class="linha"><td>30/11/2026</td><td>Frete Curitiba</td><td>Frete</td><td class="valor">+ R$ 1,13</td><td>Recebido</td></tr>',
    ]);
  });

  it('termina com os três totais, uma vez, depois da última linha (EXP-11)', () => {
    const html = gerarHtmlPdf({
      ...BASE,
      transacoes: [
        transacao({ valorCentavos: 100000 }),
        transacao({ valorCentavos: 50000, status: 'Pendente' }),
        transacao({ tipo: 'Saida', valorCentavos: 30050 }),
        transacao({ tipo: 'Saida', valorCentavos: 113, status: 'Pendente' }),
      ],
    });

    expect(html).toContain('<tr><td>Total de entradas</td><td class="valor">+ R$ 1.500,00</td></tr>');
    expect(html).toContain('<tr><td>Total de saídas</td><td class="valor">− R$ 301,63</td></tr>');
    expect(html).toContain('<tr><td>Saldo do período</td><td class="valor">R$ 1.198,37</td></tr>');
    expect(html.match(/Total de entradas/g)).toHaveLength(1);
    expect(html.match(/Saldo do período/g)).toHaveLength(1);
    expect(html.indexOf('Total de entradas')).toBeGreaterThan(html.lastIndexOf('<tr class="linha">'));
  });

  it('saldo negativo sai com o sinal de menos (EXP-11)', () => {
    const html = gerarHtmlPdf({
      ...BASE,
      transacoes: [transacao({ valorCentavos: 10000 }), transacao({ tipo: 'Saida', valorCentavos: 25000 })],
    });

    expect(html).toContain('<tr><td>Saldo do período</td><td class="valor">− R$ 150,00</td></tr>');
  });

  it('com muitas linhas, mantém todas e repete o cabeçalho em cada página sem cortar linha (EXP-12)', () => {
    const transacoes = Array.from({ length: 300 }, (_, indice) =>
      transacao({ id: `id-${indice}`, descricao: `Lançamento ${indice + 1}`, valorCentavos: 100 }),
    );

    const html = gerarHtmlPdf({ ...BASE, transacoes });

    const linhas = linhasDaTabela(html);
    expect(linhas).toHaveLength(300);
    expect(linhas[0]).toContain('<td>Lançamento 1</td>');
    expect(linhas[299]).toContain('<td>Lançamento 300</td>');
    expect(html).toContain('@page { size: A4;');
    expect(html).toContain('thead { display: table-header-group; }');
    expect(html).toContain('tr { page-break-inside: avoid; break-inside: avoid; }');
    expect(html).toContain('<tr><td>Total de entradas</td><td class="valor">+ R$ 300,00</td></tr>');
  });

  it('escapa o texto digitado antes de montar o HTML (EXP-13)', () => {
    const html = gerarHtmlPdf({
      ...BASE,
      empresa: 'Silva & Filhos <Ltda>',
      transacoes: [transacao({ descricao: '<script>alert("x")</script>', categoria: "D'Ávila & Cia" })],
    });

    expect(html).toContain('<h1>Silva &amp; Filhos &lt;Ltda&gt;</h1>');
    expect(html).toContain('<td>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</td>');
    expect(html).toContain('<td>D&#39;Ávila &amp; Cia</td>');
    expect(html).not.toContain('<script>');
  });

  it('sem transações, mostra o aviso na tabela e os totais zerados (EXP-22)', () => {
    const html = gerarHtmlPdf({ ...BASE, transacoes: [] });

    expect(linhasDaTabela(html)).toHaveLength(0);
    expect(html).toContain('Nenhuma transação no período.');
    expect(html).toContain('<tr><td>Total de entradas</td><td class="valor">+ R$ 0,00</td></tr>');
    expect(html).toContain('<tr><td>Total de saídas</td><td class="valor">R$ 0,00</td></tr>');
    expect(html).toContain('<tr><td>Saldo do período</td><td class="valor">R$ 0,00</td></tr>');
  });
});

describe('escaparHtml (EXP-13)', () => {
  it('troca os cinco caracteres especiais', () => {
    expect(escaparHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('PAGINA_A4 (EXP-12)', () => {
  it('é a folha A4 em pontos', () => {
    expect(PAGINA_A4).toEqual({ width: 595, height: 842 });
  });
});
