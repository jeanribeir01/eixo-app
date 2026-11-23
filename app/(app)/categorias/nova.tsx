import { useLocalSearchParams } from 'expo-router';

import { CategoriaFormView } from '@/features/categorias/CategoriaFormView';

// `?tipo=Saida` ou `?tipo=Entrada` vem da aba da lista; qualquer outro valor é ignorado.
export default function NovaCategoriaRoute() {
  const { tipo } = useLocalSearchParams<{ tipo?: string }>();
  const tipoInicial = tipo === 'Saida' || tipo === 'Entrada' ? tipo : undefined;

  return <CategoriaFormView tipoInicial={tipoInicial} />;
}
