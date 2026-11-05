import { RevisoesViagensView } from '@/features/viagens/RevisoesViagensView';

// Fila de revisão das viagens (EIX-41). O guard de Admin/Gestor fica no layout; o RLS de
// `viagem_revisao` é a barreira real.
export default function RevisoesViagensRoute() {
  return <RevisoesViagensView />;
}
