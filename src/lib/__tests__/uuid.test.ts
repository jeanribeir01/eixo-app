import { gerarUuidV7 } from '../uuid';

const FORMATO_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('gerarUuidV7', () => {
  it('gera UUID versão 7 com a variante da RFC 9562', () => {
    expect(gerarUuidV7()).toMatch(FORMATO_V7);
  });

  it('guarda o horário em milissegundos nos 48 primeiros bits', () => {
    const agora = Date.UTC(2026, 9, 25, 12, 0, 0, 123);

    const id = gerarUuidV7(agora);

    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(agora);
  });

  it('id gerado depois é maior: a ordem dos ids segue a ordem de criação', () => {
    const antes = gerarUuidV7(Date.UTC(2026, 9, 25, 12, 0, 0, 0));
    const depois = gerarUuidV7(Date.UTC(2026, 9, 25, 12, 0, 0, 1));

    expect(depois > antes).toBe(true);
  });

  it('dois ids no mesmo milissegundo não se repetem (parte aleatória)', () => {
    const agora = Date.now();
    const ids = new Set(Array.from({ length: 1000 }, () => gerarUuidV7(agora)));

    expect(ids.size).toBe(1000);
  });
});
