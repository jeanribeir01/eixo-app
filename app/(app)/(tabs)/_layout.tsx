import { Tabs } from 'expo-router';

import { hrefDaAba, useMenu } from '@/navigation/menu';
import { tabBarOptions } from '@/navigation/tabBarOptions';
import { TabBarIcon } from '@/ui';

// Menu por perfil (US17). Quais abas existem vem só de `useMenu()`; aqui não há regra de perfil.
// Aba fora do perfil não é registrada (fica oculta, não desabilitada), e a URL dela leva de volta
// à aba inicial do perfil.
//
// Desde o SDK 58 o expo-router não aceita mais `initialRouteName` como prop do navegador. A aba inicial
// vem de dois lugares: o redirect de `index.tsx` (quem abre `/`) e o `redirectTo` de cada aba bloqueada
// (quem digita a URL de uma aba fora do perfil).
export default function TabsLayout() {
  const { abas, abaInicial } = useMenu();
  const inicioDoPerfil = hrefDaAba(abaInicial);

  return (
    <Tabs backBehavior="history" screenOptions={tabBarOptions}>
      {/* `/` só redireciona para a aba inicial do perfil; não aparece na barra. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      {abas.map((aba) => (
        <Tabs.Protected key={aba.id} guard={aba.visivel} redirectTo={inicioDoPerfil}>
          <Tabs.Screen
            name={aba.id}
            options={{
              title: aba.rotulo,
              // Aba ativa: ícone cheio sobre pílula accentSoft; inativa: contorno (DESIGN_CYAN 2.0 §7).
              tabBarIcon: ({ focused }) => <TabBarIcon name={aba.icone} focused={focused} />,
            }}
          />
        </Tabs.Protected>
      ))}
    </Tabs>
  );
}
