import { SEM_ROTA, trecho, trechoDaViagem, ufsDoTrecho } from '../trecho';

const rota = { cidade_origem: 'Belo Horizonte', uf_origem: 'MG', cidade_destino: 'Porto Alegre', uf_destino: 'RS' };

describe('trecho', () => {
  it('só as cidades, sem a barra da UF que quebrava a linha no Android', () => {
    expect(trecho(rota)).toBe('Belo Horizonte → Porto Alegre');
  });

  it('as UFs à parte, para o subtítulo', () => {
    expect(ufsDoTrecho(rota)).toBe('MG → RS');
  });

  it('viagem com rota mostra o trecho; sem rota (nula ou ausente), avisa que não foi informada', () => {
    expect(trechoDaViagem({ rota })).toBe('Belo Horizonte → Porto Alegre');
    expect(trechoDaViagem({ rota: null })).toBe(SEM_ROTA);
    expect(trechoDaViagem({})).toBe('Rota não informada');
  });
});
