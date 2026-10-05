import { Stack } from 'expo-router';

import { useMenu } from '@/navigation/menu';

// Área de usuário autenticado e aprovado. As abas (menu por perfil, US17) ficam em (tabs);
// telas internas como Categorias, Formas de Pagamento e Usuários abrem por cima delas, nesta pilha.
export default function AppLayout() {
  const { podeVerCategorias, podeVerUsuarios } = useMenu();

  // Rota fora do perfil nem existe na árvore: digitar a URL cai de volta nas abas, que abrem
  // na tela inicial do perfil. O RLS é quem garante de fato — esconder rota é usabilidade.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Abas declaradas primeiro: o Stack abre na primeira tela listada. */}
      <Stack.Screen name="(tabs)" />
      <Stack.Protected guard={podeVerCategorias}>
        <Stack.Screen name="categorias/index" />
        <Stack.Screen name="categorias/nova" />
        <Stack.Screen name="categorias/[id]/editar" />
        <Stack.Screen name="formas-pagamento/index" />
        <Stack.Screen name="formas-pagamento/nova" />
        <Stack.Screen name="formas-pagamento/[id]/editar" />
        {/* Saldo e projeção (US05) é do módulo Financeiro: mesmo guard, Admin e Financeiro. */}
        <Stack.Screen name="caixa/index" />
      </Stack.Protected>
      <Stack.Protected guard={podeVerUsuarios}>
        <Stack.Screen name="usuarios/index" />
        <Stack.Screen name="usuarios/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
