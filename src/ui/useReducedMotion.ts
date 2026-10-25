import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion as useInitialReducedMotion } from 'react-native-reanimated';

// Preferência nativa inicial e alterações com o app aberto, inclusive ao voltar dos ajustes.
export function useReducedMotion() {
  const initialReduced = useInitialReducedMotion();
  const [reduced, setReduced] = useState(initialReduced);

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
