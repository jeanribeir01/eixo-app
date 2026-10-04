import { Stack } from 'expo-router';

// Área de quem está logado mas ainda não tem acesso (perfil carregando, erro, pendente ou bloqueado).
export default function PendenteLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
