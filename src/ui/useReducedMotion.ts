import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Até conhecer a preferência, mantém a interface parada. Também responde à troca com o app aberto.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      changed = true;
      if (active) setReduced(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => { if (active && !changed) setReduced(value); },
      () => { /* Sem preferência disponível, preserva a versão estática. */ },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
