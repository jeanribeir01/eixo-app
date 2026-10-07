import { Stack } from 'expo-router';

import { useMenu } from '@/navigation/menu';
import { stackOptions } from '@/navigation/stackOptions';

// Área de usuário autenticado e aprovado. As abas (menu por perfil, US17) ficam em (tabs);
// telas internas como Categorias, Formas de Pagamento, Movimentações, cadastro de veículo e Usuários
// abrem por cima delas, nesta pilha, com header nativo (título + voltar). O título de cada tela mora
// aqui, junto do guard: a tela nunca configura o próprio header.
export default function AppLayout() {
  const { podeVerCategorias, podeVerFrota, podeVerUsuarios } = useMenu();

  // Rota fora do perfil nem existe na árvore: digitar a URL cai de volta nas abas, que abrem
  // na tela inicial do perfil. O RLS é quem garante de fato — esconder rota é usabilidade.
  return (
    <Stack screenOptions={stackOptions}>
      {/* Abas declaradas primeiro: o Stack abre na primeira tela listada. */}
      {/* As abas não têm header nativo: cada aba mostra o próprio título no conteúdo. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Protected guard={podeVerCategorias}>
        <Stack.Screen name="categorias/index" options={{ title: 'Categorias' }} />
        <Stack.Screen name="categorias/nova" options={{ title: 'Nova categoria' }} />
        <Stack.Screen name="categorias/[id]/editar" options={{ title: 'Editar categoria' }} />
        <Stack.Screen name="formas-pagamento/index" options={{ title: 'Formas de pagamento' }} />
        <Stack.Screen name="formas-pagamento/nova" options={{ title: 'Nova forma de pagamento' }} />
        <Stack.Screen name="formas-pagamento/[id]/editar" options={{ title: 'Editar forma de pagamento' }} />
        <Stack.Screen name="movimentacoes/index" options={{ title: 'Movimentações' }} />
        <Stack.Screen name="movimentacoes/nova" options={{ title: 'Nova movimentação' }} />
        <Stack.Screen name="movimentacoes/[id]/editar" options={{ title: 'Editar movimentação' }} />
        {/* Saldo e projeção (US05) é do módulo Financeiro: mesmo guard, Admin e Financeiro. */}
        <Stack.Screen name="caixa/index" options={{ title: 'Saldo e projeção' }} />
        {/* Dívidas e parcelamentos (US04) também: o RLS de `divida` só libera Admin e Financeiro. */}
        <Stack.Screen name="dividas/index" options={{ title: 'Dívidas' }} />
        <Stack.Screen name="dividas/nova" options={{ title: 'Nova dívida' }} />
        <Stack.Screen name="dividas/[id]" options={{ title: 'Dívida' }} />
      </Stack.Protected>
      <Stack.Protected guard={podeVerFrota}>
        <Stack.Screen name="frota/novo" options={{ title: 'Novo veículo' }} />
        <Stack.Screen name="frota/[id]/editar" options={{ title: 'Editar veículo' }} />
      </Stack.Protected>
      <Stack.Protected guard={podeVerUsuarios}>
        <Stack.Screen name="usuarios/index" options={{ title: 'Usuários' }} />
        <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuário' }} />
      </Stack.Protected>
    </Stack>
  );
}
