import { chaveCidade, limparCidade } from '../cidade';

describe('limparCidade', () => {
  // ROTA-03: o banco rejeita cidade com espaço nas pontas ou repetido (`rota_cidade_*_normalizada`).
  it('tira os espaços das pontas e junta os repetidos', () => {
    expect(limparCidade('  São   Paulo  ')).toBe('São Paulo');
  });

  it('troca tabulação e quebra de linha por um espaço, como o `\\s+` da constraint', () => {
    expect(limparCidade('Rio\tde\n Janeiro')).toBe('Rio de Janeiro');
  });

  it('mantém maiúsculas e acentos: só o espaço é normalizado na gravação', () => {
    expect(limparCidade('São Paulo')).toBe('São Paulo');
  });
});

describe('chaveCidade', () => {
  // ROTA-11: maiúscula, espaço e acento não diferenciam uma cidade da outra.
  it('gera a mesma chave para nomes que só diferem por maiúscula, espaço ou acento', () => {
    const chave = chaveCidade('São Paulo');

    expect(chave).toBe('sao paulo');
    expect(chaveCidade(' sao  paulo ')).toBe(chave);
    expect(chaveCidade('SÃO PAULO')).toBe(chave);
    expect(chaveCidade('Sao Paulo')).toBe(chave);
  });

  it('remove os acentos da lista do banco, inclusive em maiúscula', () => {
    expect(chaveCidade('ÁÀÂÃÄ ÉÈÊË ÍÌÎÏ ÓÒÔÕÖ ÚÙÛÜ Ç Ñ')).toBe('aaaaa eeee iiii ooooo uuuu c n');
    expect(chaveCidade('áàâãä éèêë íìîï óòôõö úùûü ç ñ')).toBe('aaaaa eeee iiii ooooo uuuu c n');
  });

  it('mantém cidades diferentes com chaves diferentes', () => {
    expect(chaveCidade('Curitiba')).not.toBe(chaveCidade('Cuiabá'));
  });
});
