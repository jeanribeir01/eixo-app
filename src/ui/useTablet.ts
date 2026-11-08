import { useWindowDimensions } from 'react-native';

import { layout } from './tokens';

// Critério único de "tela de tablet" (RNF02). O Screen e as telas responsivas usam este hook,
// para que todos mudem juntos se o critério mudar (outro breakpoint, menor dimensão etc.).
export function useTablet() {
  return useWindowDimensions().width >= layout.tablet;
}
