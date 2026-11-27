import { Stack } from 'expo-router';

import { useMenu } from '@/navigation/menu';
import { stackOptions } from '@/navigation/stackOptions';

// Área de usuário autenticado e aprovado. As abas (menu por perfil, US17) ficam em (tabs);
// telas internas como Categorias, Movimentações, Veículos, Rotas, Manutenções, Viagens e Usuários
// abrem por cima delas, nesta pilha, com header nativo (título + voltar). O título de cada tela mora
// aqui, junto do guard: a tela nunca configura o próprio header.
export default function AppLayout() {
  const { podeVerCategorias, podeVerFrota, podeVerViagens, viagensForaDaAba, podeVerUsuarios } = useMenu();

  // Rota fora do perfil nem existe na árvore: digitar a URL cai de volta nas abas, que abrem
  // na tela inicial do perfil. O RLS é quem garante de fato — esconder rota é usabilidade.
  // O `redirectTo="/"` leva às abas, que abrem na aba inicial do perfil (desde o SDK 58 o destino
  // precisa ser explícito).
  return (
    <Stack screenOptions={stackOptions}>
      {/* Abas declaradas primeiro: o Stack abre na primeira tela listada. */}
      {/* As abas não têm header nativo: cada aba mostra o próprio título no conteúdo. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Protected guard={podeVerCategorias} redirectTo="/">
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
        {/* Ponte Caixa ↔ Viagens (US09): os lançamentos de cada viagem. O Financeiro não lê `viagem`
            direto; a tela usa as RPCs da ponte. Gestor e Motorista não leem movimentação. */}
        <Stack.Screen name="viagens/lancamentos" options={{ title: 'Lançamentos por viagem' }} />
        <Stack.Screen name="viagens/[id]/lancamentos" options={{ title: 'Lançamentos da viagem' }} />
      </Stack.Protected>
      <Stack.Protected guard={podeVerFrota} redirectTo="/">
        {/* Lista em `frota/veiculos`, não em `frota/index`: esse teria a URL da aba Frota (`/frota`). */}
        <Stack.Screen name="frota/veiculos" options={{ title: 'Veículos' }} />
        <Stack.Screen name="frota/novo" options={{ title: 'Novo veículo' }} />
        <Stack.Screen name="frota/[id]/editar" options={{ title: 'Editar veículo' }} />
        {/* Detalhe com o histórico de manutenções (US06-b): aberto pela lista de Veículos e pela aba Frota. */}
        <Stack.Screen name="frota/[id]/index" options={{ title: 'Veículo' }} />
        {/* Rotas (US07) e Manutenções (US06-b): mesmos perfis do RLS de `rota` e da RPC de manutenção. */}
        <Stack.Screen name="rotas/index" options={{ title: 'Rotas' }} />
        <Stack.Screen name="rotas/nova" options={{ title: 'Nova rota' }} />
        <Stack.Screen name="rotas/[id]/editar" options={{ title: 'Editar rota' }} />
        <Stack.Screen name="manutencoes/index" options={{ title: 'Manutenções' }} />
        <Stack.Screen name="manutencoes/nova" options={{ title: 'Nova manutenção' }} />
        {/* Revisões de viagens: só Admin/Gestor decidem; o Motorista nem vê a rota. */}
        <Stack.Screen name="viagens/revisoes" options={{ title: 'Revisões de viagens' }} />
      </Stack.Protected>
      {/* Viagens (US08) seguem a aba: o Motorista também abre e fecha. A lista é a própria aba. */}
      <Stack.Protected guard={podeVerViagens} redirectTo="/">
        <Stack.Screen name="viagens/nova" options={{ title: 'Abrir viagem' }} />
        <Stack.Screen name="viagens/[id]/index" options={{ title: 'Viagem' }} />
        <Stack.Screen name="viagens/[id]/fechar" options={{ title: 'Finalizar viagem' }} />
      </Stack.Protected>
      {/* A lista de viagens fora da aba: só para quem vê viagens e não tem a aba (Admin). */}
      <Stack.Protected guard={viagensForaDaAba} redirectTo="/">
        <Stack.Screen name="frota/viagens" options={{ title: 'Viagens' }} />
      </Stack.Protected>
      <Stack.Protected guard={podeVerUsuarios} redirectTo="/">
        <Stack.Screen name="usuarios/index" options={{ title: 'Usuários' }} />
        <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuário' }} />
      </Stack.Protected>
    </Stack>
  );
}
