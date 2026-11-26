import { act } from '@testing-library/react-native';

// Por que este arquivo existe
// ---------------------------
// Na Testing Library 14, `await fireEvent.press(botao)` espera o handler do botão terminar: se o
// `onPress` é async, o await só volta depois do "salvar" inteiro. É o que se quer na maioria dos testes.
//
// Os testes de estado intermediário ("enquanto salva, o botão fica em loading") deixam o salvar
// pendente de propósito, para olhar a tela no meio do caminho. Com o await normal, o teste ficaria
// parado para sempre (timeout). Este helper dispara o evento, espera o React aplicar o que o toque
// mudou na tela (o loading) e devolve a promessa do handler para o teste esperar depois.
//
// Uso:
//   const salvar = await dispararSemEsperar(() => fireEvent.press(botaoSalvar));
//   expect(botaoSalvar).toBeDisabled();           // estado no meio do caminho
//   await act(async () => { concluir(); await salvar.terminou; });
//
// O retorno é um objeto, e não a promessa direto, de propósito: uma função async que devolve uma
// promessa faz o `await` de quem chama esperar por ela, o que traria o timeout de volta.
export async function dispararSemEsperar(disparar: () => Promise<unknown>): Promise<{ terminou: Promise<unknown> }> {
  let terminou: Promise<unknown> = Promise.resolve();
  await act(async () => {
    terminou = disparar();
  });
  return { terminou };
}

// Primeira carga que só responde quando o teste mandar.
// ---------------------------------------------------
// `await render(...)` espera as promessas já resolvidas. Com um mock que responde na hora, a tela já
// passou do "carregando" quando o teste olha. Para afirmar o estado de carregamento, este helper segura
// a primeira chamada do mock até o teste liberar; a resposta é a mesma que o mock já daria (o
// `mockResolvedValue` do teste ou do beforeEach). As chamadas seguintes respondem normalmente.
//
// Uso (depois de configurar o mock, antes do render):
//   const liberarCarga = segurarPrimeiraCarga(mockListar);
//   await render(<CategoriasListView />);
//   expect(screen.getByLabelText('Carregando categorias')).toBeOnTheScreen();
//   await liberarCarga();
//   expect(screen.getByText('Combustível')).toBeOnTheScreen();
export function segurarPrimeiraCarga<T, A extends unknown[]>(mock: jest.MockInstance<Promise<T>, A>): () => Promise<void> {
  const original = mock.getMockImplementation();
  if (!original) throw new Error('segurarPrimeiraCarga: configure a resposta do mock (mockResolvedValue) antes');
  let liberar: () => void = () => undefined;
  const portao = new Promise<void>((resolve) => (liberar = resolve));
  let chamada: Promise<T> | undefined;
  mock.mockImplementationOnce((...args: A) => {
    chamada = portao.then(() => original(...args));
    return chamada;
  });
  return () =>
    act(async () => {
      liberar();
      await chamada;
    });
}
