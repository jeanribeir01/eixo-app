import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// Uma única leitura da preferência "remover animações" para o app inteiro. Antes cada linha de lista
// e cada Skeleton abria o próprio listener e fazia a própria chamada nativa; agora o primeiro
// componente que monta abre a assinatura e os demais leem o mesmo valor.
//
// null = ainda não sabemos. Enquanto isso o hook responde "sem movimento": é mais seguro não animar
// por um instante do que animar para quem pediu ao sistema que não anime. O snapshot de inicialização
// do Reanimated não serve aqui porque fica velho se a pessoa muda a preferência com o app aberto.
let atual: boolean | null = null;
const ouvintes = new Set<() => void>();
let assinatura: { remove: () => void } | null = null;

function definir(valor: boolean) {
  if (atual === valor) return;
  atual = valor;
  ouvintes.forEach((avisar) => avisar());
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  if (!assinatura) {
    let mudouAntes = false;
    const esta = AccessibilityInfo.addEventListener('reduceMotionChanged', (valor) => {
      mudouAntes = true;
      definir(valor);
    });
    assinatura = esta;
    // A resposta só vale se esta assinatura ainda está aberta e nenhum evento (mais novo) chegou antes.
    const aindaVale = () => assinatura === esta && !mudouAntes;
    AccessibilityInfo.isReduceMotionEnabled().then(
      (valor) => {
        if (aindaVale()) definir(valor);
      },
      () => {
        // Sem preferência disponível no aparelho: segue o padrão do sistema, que é animar.
        if (aindaVale()) definir(false);
      },
    );
  }
  return () => {
    ouvintes.delete(avisar);
    // Sem ninguém ouvindo, a assinatura fecha e o valor volta a "não sei": ele poderia ficar velho.
    if (ouvintes.size === 0 && assinatura) {
      assinatura.remove();
      assinatura = null;
      atual = null;
    }
  };
}

function lerValor() {
  return atual ?? true;
}

export function useReducedMotion() {
  return useSyncExternalStore(assinar, lerValor, lerValor);
}
