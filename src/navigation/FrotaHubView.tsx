import { useRouter, type Href } from 'expo-router';

import { ListItem, ListSection, Screen, Text, type IconName } from '@/ui';

type Atalho = { titulo: string; descricao: string; icone: IconName; href: Href };

// O dia a dia da frota primeiro; os cadastros, que mudam pouco, embaixo (mesmo critério do hub
// Financeiro). Viagens não entra aqui: é uma aba própria, que o Motorista também usa.
const OPERACAO: Atalho[] = [
  { titulo: 'Manutenções', descricao: 'Ordens de serviço e despesa no caixa', icone: 'manutencoes', href: '/manutencoes' },
];

const CADASTROS: Atalho[] = [
  { titulo: 'Veículos', descricao: 'Placa, capacidade e status', icone: 'frota', href: '/frota/veiculos' },
  { titulo: 'Rotas', descricao: 'Trechos padrão e distância estimada', icone: 'rotas', href: '/rotas' },
];

// Aba Frota (EIX-77): o menu do módulo. A lista de veículos mora em `/frota/veiculos` e não em
// `frota/index`, porque `frota/index` teria a mesma URL da aba (`/frota`) e o expo-router abriria a
// lista no lugar do hub.
export function FrotaHubView() {
  const router = useRouter();

  function linha(atalho: Atalho) {
    return (
      <ListItem
        key={atalho.titulo}
        title={atalho.titulo}
        subtitle={atalho.descricao}
        icon={atalho.icone}
        onPress={() => router.push(atalho.href)}
      />
    );
  }

  return (
    <Screen scroll>
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Frota</Text>

      <ListSection label="Operação">{OPERACAO.map(linha)}</ListSection>
      <ListSection label="Cadastros">{CADASTROS.map(linha)}</ListSection>
    </Screen>
  );
}
