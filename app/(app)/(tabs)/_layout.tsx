import { Tabs } from 'expo-router';

import { useMenu } from '@/navigation/menu';
import { tabBarOptions } from '@/navigation/tabBarOptions';

// Menu por perfil (US17). Quais abas existem vem só de `useMenu()`; aqui não há regra de perfil.
// Aba fora do perfil não é registrada (fica oculta, não desabilitada), e a URL dela leva de volta
// à aba inicial do perfil.
export default function TabsLayout() {
  const { abas, abaInicial } = useMenu();

  return (
    <Tabs initialRouteName={abaInicial} backBehavior="history" screenOptions={tabBarOptions}>
      {/* `/` só redireciona para a aba inicial do perfil; não aparece na barra. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      {abas.map((aba) => (
        <Tabs.Protected key={aba.id} guard={aba.visivel}>
          <Tabs.Screen name={aba.id} options={{ title: aba.rotulo }} />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
