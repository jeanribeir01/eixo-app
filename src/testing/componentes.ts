import { screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import type { TestInstance } from 'test-renderer';

// Por que este arquivo existe
// ---------------------------
// Até a Testing Library 13, os testes achavam um componente pelo tipo (`screen.UNSAFE_getByType(FlatList)`)
// e liam as props que a tela passou para ele. A versão 14 (exigida pelo Expo SDK 58) removeu essas
// queries: o renderizador novo só expõe os elementos nativos (View, Text, RCTScrollView...), não os
// componentes React que os criaram.
//
// Muitos testes daqui verificam justamente o que a tela passa para um componente (o `edges` do
// SafeAreaView, o `contentContainerStyle` da lista, o `onRefresh` do RefreshControl). Reescrever cada
// um para olhar o elemento nativo mudaria o que o teste prova. Este helper devolve as mesmas props,
// lendo a árvore interna do React (`unstable_fiber`).
//
// O preço: `unstable_fiber` é API instável do renderizador. Se uma versão futura do React mudar a
// estrutura interna, o conserto fica todo aqui, num arquivo só, e os testes não mudam.
//
// Prefira sempre as queries normais (getByRole, getByText, getByTestId). Use este helper só quando o
// teste precisa da prop de um componente que não aparece na tela.

// Só os campos da fibra do React que este helper usa.
type Fibra = {
  type: unknown;
  elementType: unknown;
  memoizedProps: unknown;
  child: Fibra | null;
  sibling: Fibra | null;
  return: Fibra | null;
  stateNode: unknown;
  alternate: Fibra | null;
};

export type ComponenteEncontrado<P> = {
  /** As props que a tela passou para o componente, na renderização mais recente. */
  props: P;
  /** Procura outro componente só dentro deste (ex.: o ScrollView dentro do KeyboardAvoidingView). */
  porTipo<Q>(tipo: ComponentType<Q>): ComponenteEncontrado<Q>;
  /** O primeiro elemento nativo desenhado pelo componente: serve para `within(...)` e `fireEvent(...)`. */
  elementoNativo(): TestInstance;
};

function fibraDe(instancia: TestInstance): Fibra | null {
  return instancia.unstable_fiber as Fibra | null;
}

// Sobe até a raiz da árvore e pega a versão atual dela: o React guarda duas cópias de cada fibra, e
// só a `current` da raiz garante as props da última renderização (depois de um rerender, por exemplo).
function raizAtual(): Fibra | null {
  const primeiro = screen.container.children.find((filho): filho is TestInstance => typeof filho !== 'string');
  if (!primeiro) return null;
  let fibra = fibraDe(primeiro);
  while (fibra?.return) fibra = fibra.return;
  const fiberRoot = fibra?.stateNode as { current?: Fibra } | undefined;
  return fiberRoot?.current ?? fibra;
}

function eDoTipo(fibra: Fibra, tipo: unknown): boolean {
  // `elementType` cobre componentes com memo(); `type` cobre o resto.
  return fibra.type === tipo || fibra.elementType === tipo;
}

// `profundo = false` não procura dentro de um componente que já bateu, como o antigo `getByType`:
// o ScrollView de um formulário que tem outro ScrollView dentro (abas roláveis) conta como um só.
function coletar(inicio: Fibra | null, tipo: unknown, profundo: boolean): Fibra[] {
  const achadas: Fibra[] = [];
  const visitar = (fibra: Fibra | null) => {
    for (let atual = fibra; atual; atual = atual.sibling) {
      if (eDoTipo(atual, tipo)) {
        achadas.push(atual);
        if (!profundo) continue;
      }
      visitar(atual.child);
    }
  };
  visitar(inicio);
  return achadas;
}

function nomeDo(tipo: unknown): string {
  if (typeof tipo === 'function') return tipo.name || 'componente';
  const comNome = tipo as { displayName?: string } | null;
  return comNome?.displayName ?? 'componente';
}

function embrulhar<P>(fibra: Fibra): ComponenteEncontrado<P> {
  return {
    props: fibra.memoizedProps as P,
    porTipo: (tipo) => unico(coletar(fibra.child, tipo, false), tipo),
    elementoNativo: () => {
      // Desce até a primeira fibra nativa (stateNode próprio, type string) e acha a instância de teste dela.
      let atual: Fibra | null = fibra;
      while (atual && typeof atual.type !== 'string') atual = atual.child;
      if (!atual) throw new Error(`${nomeDo(fibra.type)} não desenhou nenhum elemento nativo`);
      const alvo = atual;
      // O container não tem fibra (null): sem o `fibra !== null`, ele casaria com um `alternate` null.
      const [instancia] = screen.container.queryAll((no) => {
        const fibraDoNo = fibraDe(no);
        return fibraDoNo !== null && (fibraDoNo === alvo || fibraDoNo === alvo.alternate);
      });
      if (!instancia) throw new Error(`Elemento nativo de ${nomeDo(fibra.type)} não encontrado`);
      return instancia;
    },
  };
}

function unico<P>(achadas: Fibra[], tipo: unknown): ComponenteEncontrado<P> {
  if (achadas.length !== 1) {
    throw new Error(`Esperava 1 ${nomeDo(tipo)} na tela, achei ${achadas.length}`);
  }
  return embrulhar<P>(achadas[0]);
}

/** Substitui `screen.UNSAFE_getByType`: exige exatamente um componente do tipo na tela. */
export function porTipo<P>(tipo: ComponentType<P>): ComponenteEncontrado<P> {
  return unico(coletar(raizAtual(), tipo, false), tipo);
}

/** Substitui `screen.UNSAFE_getAllByType` e `UNSAFE_queryAllByType`: todos os do tipo, talvez nenhum. */
export function todosPorTipo<P>(tipo: ComponentType<P>): ComponenteEncontrado<P>[] {
  return coletar(raizAtual(), tipo, true).map((fibra) => embrulhar<P>(fibra));
}

/** Substitui `screen.UNSAFE_queryByType`: o componente do tipo, ou null se não houver nenhum. */
export function talvezPorTipo<P>(tipo: ComponentType<P>): ComponenteEncontrado<P> | null {
  const achadas = coletar(raizAtual(), tipo, false);
  return achadas.length === 0 ? null : unico<P>(achadas, tipo);
}
