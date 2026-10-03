import { Redirect } from 'expo-router';

import { hrefDaAba, useMenu } from '@/navigation/menu';

// `/` não tem tela própria: cada perfil abre na sua aba inicial (o Motorista, em Viagens).
export default function InicioRoute() {
  const { abaInicial } = useMenu();
  return <Redirect href={hrefDaAba(abaInicial)} />;
}
