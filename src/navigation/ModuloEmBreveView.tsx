import { useRouter, type Href } from 'expo-router';

import { Button, Column, EmptyState, Screen, Text } from '@/ui';

type Atalho = { rotulo: string; href: Href };

type ModuloEmBreveViewProps = {
  titulo: string;
  // Telas do módulo que já existem (ex.: Categorias no Financeiro) continuam acessíveis daqui.
  atalhos?: Atalho[];
};

// Destino provisório das abas cujos módulos ainda não foram construídos (US17). Cada US do módulo
// troca este placeholder pela tela real, sem mexer no menu.
export function ModuloEmBreveView({ titulo, atalhos = [] }: ModuloEmBreveViewProps) {
  const router = useRouter();

  return (
    <Screen>
      <Text variant="heading">{titulo}</Text>

      {atalhos.length > 0 && (
        <Column gap="sm">
          {atalhos.map((atalho) => (
            <Button key={atalho.rotulo} label={atalho.rotulo} variant="ghost" onPress={() => router.push(atalho.href)} />
          ))}
        </Column>
      )}

      <EmptyState title="Em breve" description="Este módulo ainda está em construção." />
    </Screen>
  );
}
