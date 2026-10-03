import { ModuloEmBreveView } from '@/navigation/ModuloEmBreveView';

export default function FinanceiroRoute() {
  return <ModuloEmBreveView titulo="Financeiro" atalhos={[{ rotulo: 'Categorias', href: '/categorias' }]} />;
}
