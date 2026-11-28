import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MesEmAndamentoCard } from '@/features/caixa/components/MesEmAndamentoCard';
import { ProximosVencimentos } from '@/features/caixa/components/ProximosVencimentos';
import { buscarMesEmAndamento } from '@/features/caixa/mesEmAndamento';
import { hojeISO } from '@/lib/datas';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  AvisoSemInternet,
  Button,
  Card,
  Column,
  FAB,
  type IconName,
  ListItem,
  ListSection,
  Screen,
  Skeleton,
  Snackbar,
  Text,
  useTablet,
} from '@/ui';
import { spacing } from '@/ui/tokens';

type Atalho = { titulo: string; descricao: string; icone: IconName; href: Href };

// O dia a dia do caixa primeiro; os cadastros, que mudam pouco, embaixo.
const CAIXA: Atalho[] = [
  { titulo: 'Movimentações', descricao: 'Entradas e saídas do mês', icone: 'movimentacoes', href: '/movimentacoes' },
  { titulo: 'Saldo e projeção', descricao: 'Saldo atual e previsão dos próximos meses', icone: 'saldo', href: '/caixa' },
  { titulo: 'Dívidas', descricao: 'Financiamentos e parcelas', icone: 'dividas', href: '/dividas' },
  // US09: o que cada viagem gerou de receita e despesa.
  {
    titulo: 'Lançamentos por viagem',
    descricao: 'Fretes e despesas de cada viagem',
    icone: 'viagens',
    href: '/viagens/lancamentos',
  },
];

const CADASTROS: Atalho[] = [
  { titulo: 'Categorias', descricao: 'Tipos de entrada e de saída', icone: 'categorias', href: '/categorias' },
  { titulo: 'Formas de pagamento', descricao: 'Pix, boleto, cartão e TED', icone: 'formasPagamento', href: '/formas-pagamento' },
];

// Aba Caixa (EIX-62, redesign): o mês em andamento e o que vence primeiro, depois o menu do módulo. O
// saldo saiu daqui porque já é o destaque do Início. O menu nunca depende dos dados: se a carga falhar,
// o erro fica no lugar do cartão e as linhas continuam tocáveis.
export function FinanceiroHubView() {
  const router = useRouter();
  const tablet = useTablet();
  // Carrega ao abrir e de novo sempre que a aba volta ao foco: quem acabou de lançar vê o mês novo.
  const tela = useDadosDaTela(buscarMesEmAndamento);
  const hoje = hojeISO();

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
      fab={<FAB label="Nova movimentação" onPress={() => router.push('/movimentacoes/nova')} />}
    >
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Caixa</Text>

      {tela.status === 'carregando' && (
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando o mês" />
          <Skeleton height="xxl" />
        </Column>
      )}

      {tela.status === 'erro' && (
        <Card variant="feature">
          <Text tone="body">{tela.erro ?? 'Não foi possível carregar o mês.'}</Text>
          <Button label="Tentar novamente" variant="ghost" onPress={tela.recarregar} />
        </Card>
      )}

      {tela.status === 'pronto' && tela.dados && (
        <>
          {tela.semInternet && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}
          <MesEmAndamentoCard mes={tela.dados} onPress={() => router.push('/movimentacoes')} />
          <ProximosVencimentos movimentacoes={tela.dados.proximosVencimentos} vencidos={tela.dados.vencidos} hoje={hoje} />
        </>
      )}

      <View testID="atalhos-financeiro" style={[styles.atalhos, tablet && styles.duasColunas]}>
        <View style={tablet && styles.coluna}>
          <ListSection label="Dia a dia">{CAIXA.map(linha)}</ListSection>
        </View>
        <View style={tablet && styles.coluna}>
          <ListSection label="Cadastros">{CADASTROS.map(linha)}</ListSection>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  atalhos: { gap: spacing.lg },
  duasColunas: { flexDirection: 'row', alignItems: 'flex-start' },
  coluna: { flex: 1 },
});
