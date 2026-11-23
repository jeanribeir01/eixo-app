import { useProfile } from '@/features/auth/profileStore';
import { InicioMotoristaView } from '@/features/inicio/InicioMotoristaView';
import { ViagensListView } from '@/features/viagens/ViagensListView';

// O Motorista não tem a aba Início: a aba Viagens é o início dele, com a viagem de agora em destaque.
// O Gestor de Frota vê a lista de todas as viagens, com filtros.
export default function ViagensRoute() {
  const { usuario } = useProfile();
  return usuario?.perfil === 'Motorista' ? <InicioMotoristaView /> : <ViagensListView />;
}
