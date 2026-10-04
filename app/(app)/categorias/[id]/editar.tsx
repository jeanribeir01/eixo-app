import { useLocalSearchParams } from 'expo-router';

import { CategoriaFormView } from '@/features/categorias/CategoriaFormView';

export default function EditarCategoriaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <CategoriaFormView categoriaId={id} />;
}
