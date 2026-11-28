import { useRouter, type Href } from 'expo-router';

import { ResumoDaFrota } from '@/features/frota-agora/components/ResumoDaFrota';
import { VeiculosAgora } from '@/features/frota-agora/components/VeiculosAgora';
import { buscarFrotaAgora } from '@/features/frota-agora/frotaAgora';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  AvisoSemInternet,
  Button,
  Card,
  Column,
  type IconName,
  ListItem,
  ListSection,
  Screen,
  Skeleton,
  Snackbar,
  Text,
} from '@/ui';

import { useMenu } from './menu';

type Atalho = { titulo: string; descricao: string; icone: IconName; href: Href };

// O dia a dia da frota primeiro; os cadastros, que mudam pouco, embaixo (mesmo critério do hub
// Financeiro). Viagens entra aqui só para quem não tem a aba Viagens (o Admin, que já tem 5 abas).
const VIAGENS: Atalho = { titulo: 'Viagens', descricao: 'Na estrada, concluídas e canceladas', icone: 'viagens', href: '/frota/viagens' };

const OPERACAO: Atalho[] = [
  { titulo: 'Manutenções', descricao: 'Ordens de serviço e despesa no caixa', icone: 'manutencoes', href: '/manutencoes' },
];

const CADASTROS: Atalho[] = [
  { titulo: 'Veículos', descricao: 'Placa, capacidade e status', icone: 'frota', href: '/frota/veiculos' },
  { titulo: 'Rotas', descricao: 'Trechos padrão e distância estimada', icone: 'rotas', href: '/rotas' },
];

// Aba Frota (EIX-77, redesign): o que cada veículo está fazendo agora e, embaixo, o menu do módulo. A
// lista de veículos mora em `/frota/veiculos` e não em `frota/index`, porque `frota/index` teria a mesma
// URL da aba (`/frota`) e o expo-router abriria a lista no lugar desta tela. O menu nunca depende dos
// dados: se a carga falhar, o erro fica no lugar do resumo e as linhas continuam tocáveis.
export function FrotaHubView() {
  const router = useRouter();
  const { viagensForaDaAba } = useMenu();
  const operacao = viagensForaDaAba ? [VIAGENS, ...OPERACAO] : OPERACAO;
  // Carrega ao abrir e de novo sempre que a aba volta ao foco (quem fechou uma viagem vê o veículo livre).
  const tela = useDadosDaTela(buscarFrotaAgora);

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
    <Screen
      scroll
      overlay={
        tela.feedbackErro ? <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} /> : null
      }
    >
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Frota</Text>

      {tela.status === 'carregando' && (
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando a frota" />
          <Skeleton height="xxl" />
        </Column>
      )}

      {tela.status === 'erro' && (
        <Card variant="feature">
          <Text tone="body">{tela.erro ?? 'Não foi possível carregar a frota.'}</Text>
          <Button label="Tentar novamente" variant="ghost" onPress={tela.recarregar} />
        </Card>
      )}

      {tela.status === 'pronto' && tela.dados && (
        <>
          {tela.semInternet && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}
          <ResumoDaFrota contagem={tela.dados.contagem} onPress={() => router.push('/frota/veiculos')} />
          <VeiculosAgora veiculos={tela.dados.veiculos} />
        </>
      )}

      <ListSection label="Operação">{operacao.map(linha)}</ListSection>
      <ListSection label="Cadastros">{CADASTROS.map(linha)}</ListSection>
    </Screen>
  );
}
