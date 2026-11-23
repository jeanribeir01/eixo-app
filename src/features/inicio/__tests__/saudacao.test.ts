import { dataPorExtenso, saudacao } from '../saudacao';

// Datas no fuso local: new Date(ano, mês, dia, hora) não passa por UTC.
describe('saudacao', () => {
  it.each([
    [7, 'Bom dia, Jean'],
    [13, 'Boa tarde, Jean'],
    [20, 'Boa noite, Jean'],
    [2, 'Boa noite, Jean'],
  ])('às %ih diz "%s", só com o primeiro nome', (hora, esperado) => {
    expect(saudacao(new Date(2026, 10, 23, hora), 'Jean Ribeiro')).toBe(esperado);
  });

  it('sem nome, só a saudação', () => {
    expect(saudacao(new Date(2026, 10, 23, 9), '  ')).toBe('Bom dia');
  });

  it('conta que guarda o e-mail no lugar do nome: só a saudação', () => {
    expect(saudacao(new Date(2026, 10, 23, 15), 'frotas@eixocerto.com.br')).toBe('Boa tarde');
  });
});

describe('dataPorExtenso', () => {
  it('dia da semana, dia e mês por extenso', () => {
    expect(dataPorExtenso(new Date(2026, 10, 23))).toBe('Segunda-feira, 23 de novembro');
  });
});
