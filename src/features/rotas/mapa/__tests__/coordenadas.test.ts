import { buscarCoordenadas } from '../coordenadas';

// Os testes usam o municipios.json real: provam o dado embarcado e a regra de busca juntos.
// As coordenadas esperadas são as do dataset (kelvins), na ordem [longitude, latitude] do GeoJSON.
describe('buscarCoordenadas (MAPA-03)', () => {
  it('acha a cidade pela UF e devolve [longitude, latitude]', () => {
    expect(buscarCoordenadas('Curitiba', 'PR')).toEqual([-49.2646, -25.4195]);
  });

  it('ignora maiúscula, acento e espaços sobrando, como a chaveCidade', () => {
    expect(buscarCoordenadas('  sao   PAULO ', 'SP')).toEqual([-46.6395, -23.5329]);
  });

  it('a UF faz parte da busca: Curitiba em SP não existe', () => {
    expect(buscarCoordenadas('Curitiba', 'SP')).toBeNull();
  });

  it('cidade digitada errado não é encontrada', () => {
    expect(buscarCoordenadas('Curitba', 'PR')).toBeNull();
  });

  it('acha município instalado em 2025 (dataset atualizado)', () => {
    expect(buscarCoordenadas('Boa Esperança do Norte', 'MT')).toEqual([-55.1486, -13.5067]);
  });
});
