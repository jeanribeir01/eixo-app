import { useProfile } from '@/features/auth/profileStore';

import { InicioFinanceiroView } from './InicioFinanceiroView';
import { InicioFrotaView } from './InicioFrotaView';

// Aba Início: cada perfil vê o próprio módulo. O Admin vê o financeiro, que já traz o que pede atenção
// na frota (manutenção aberta) e na equipe (usuários aguardando). O Motorista não tem a aba.
export function InicioView() {
  const { usuario } = useProfile();
  return usuario?.perfil === 'Gestor de Frota' ? <InicioFrotaView /> : <InicioFinanceiroView />;
}
