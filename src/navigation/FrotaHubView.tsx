import { useRouter, type Href } from 'expo-router';

import { ListItem, ListSection, Screen, Text, type IconName } from '@/ui';

import { useMenu } from './menu';

type Atalho = { titulo: string; descricao: string; icone: IconName; href: Href };

// O dia a dia da frota primeiro; os cadastros, que mudam pouco, embaixo (mesmo critério do hub
// Financeiro). Viagens entra aqui só para quem não tem a aba Viagens (o Admin, que já tem 5 abas).
const VIAGENS: Atalho = { titulo: 'Viagens', descricao: 'Em andamento, concluídas e canceladas', icone: 'viagens', href: '/frota/viagens' };

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
  const { viagensForaDaAba } = useMenu();
  const operacao = viagensForaDaAba ? [VIAGENS, ...OPERACAO] : OPERACAO;

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

      <ListSection label="Operação">{operacao.map(linha)}</ListSection>
      <ListSection label="Cadastros">{CADASTROS.map(linha)}</ListSection>
    </Screen>
  );
}
