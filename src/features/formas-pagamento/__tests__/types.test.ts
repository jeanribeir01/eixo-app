import { isFormaFixa } from '../types';

describe('isFormaFixa', () => {
  it('reconhece as 4 formas do seed', () => {
    for (const nome of ['Boleto', 'Pix', 'TED', 'Cartão Corporativo']) {
      expect(isFormaFixa(nome)).toBe(true);
    }
  });

  it('não trata formas criadas pelo usuário como fixas', () => {
    expect(isFormaFixa('Dinheiro')).toBe(false);
    expect(isFormaFixa('Transferência TED')).toBe(false);
  });
});
