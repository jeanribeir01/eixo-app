import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import { formatarMoedaComSinal, tomDoValor } from '@/features/caixa/formatadores';
import { ValorDaMovimentacao } from '@/features/movimentacoes/components/ValorDaMovimentacao';
import { dataDeReferencia } from '@/features/movimentacoes/movimentacoesRepository';
import type { Movimentacao } from '@/features/movimentacoes/types';
import { hojeISO, isoParaDataBR } from '@/lib/datas';
import { formatarMoeda } from '@/lib/money';
import { useDadosDaTela } from '@/lib/useDadosDaTela';
import {
  AcaoRapida,
  AvisoSemInternet,
  Card,
  Column,
  EmptyState,
  ListItem,
  ListSection,
  Screen,
  Skeleton,
  Snackbar,
  Text,
} from '@/ui';
import { spacing } from '@/ui/tokens';

import { CabecalhoInicio } from './CabecalhoInicio';
import { buscarInicioFinanceiro, type ResumoInicioFinanceiro } from './inicioFinanceiroRepository';
import { pedeAtencao } from './pedeAtencao';
import { SecaoPedeAtencao } from './SecaoPedeAtencao';

// "Hoje · Combustível · Pix": o dia em palavras quando é hoje, senão a data curta. A categoria vem antes
// da forma de pagamento: o subtítulo tem uma linha só, e quando não cabe, o corte cai no que importa menos
// ("21/11 · Combustível · Cartão Corp…", não "21/11 · Cartão Corporativo · Combu…").
function subtituloMovimentacao(movimentacao: Movimentacao, hoje: string): string {
  const data = dataDeReferencia(movimentacao);
  const dia = data === hoje ? 'Hoje' : isoParaDataBR(data).slice(0, 5);
  return [dia, movimentacao.categoria.titulo, movimentacao.formaPagamento.nome].join(' · ');
}

function CartaoSaldo({ resumo, onPress }: { resumo: ResumoInicioFinanceiro; onPress: () => void }) {
  const saldo = formatarMoedaComSinal(resumo.saldoAtualCentavos);
  return (
    <Card variant="feature" onPress={onPress} accessibilityLabel={`Saldo atual ${saldo}. Ver saldo e projeção`}>
      <Text variant="bodySm" tone="body">
        Saldo atual
      </Text>
      <Text
        variant="numeric"
        weight="semibold"
        tone={tomDoValor(resumo.saldoAtualCentavos)}
        // Saldo na casa dos milhões não quebra linha: a fonte encolhe para caber em 360 de largura.
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {saldo}
      </Text>
      <View style={styles.mes}>
        <Column gap="xs">
          <Text variant="caption" tone="body">
            Entradas pagas no mês
          </Text>
          <Text weight="medium" tone="success">{`+ ${formatarMoeda(resumo.entradasDoMesCentavos)}`}</Text>
        </Column>
        <Column gap="xs">
          <Text variant="caption" tone="body">
            Saídas pagas no mês
          </Text>
          <Text weight="medium" tone="danger">{`− ${formatarMoeda(resumo.saidasDoMesCentavos)}`}</Text>
        </Column>
      </View>
    </Card>
  );
}

// Início de Admin e Financeiro (protótipo DESIGN-CYAN 2.0, direção A): o saldo em destaque, os
// atalhos do dia a dia, o que pede atenção e o que acabou de ser lançado. O menu completo do módulo
// continua na aba Caixa.
export function InicioFinanceiroView() {
  const router = useRouter();
  const { usuario, isAdmin, canSeeFrota } = useProfile();
  // Fixo por montagem: a hora só muda a saudação, e ela volta certa quando a aba monta de novo.
  const [agora] = useState(() => new Date());

  const buscar = useCallback(
    () => buscarInicioFinanceiro({ verUsuarios: isAdmin, verManutencoes: canSeeFrota }),
    [isAdmin, canSeeFrota],
  );
  const tela = useDadosDaTela(buscar);
  const hoje = hojeISO();

  return (
    <Screen
      scroll
      overlay={
        tela.feedbackErro ? (
          <Snackbar message={tela.feedbackErro} tone="error" onDismiss={tela.limparFeedbackErro} />
        ) : undefined
      }
    >
      <CabecalhoInicio nome={usuario?.nome ?? ''} agora={agora} />

      {tela.status === 'carregando' && (
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando o início" />
          <Skeleton height="xl" />
          <Skeleton height="xxl" />
        </Column>
      )}

      {tela.status === 'erro' && (
        <EmptyState
          icon="alerta"
          title="Não deu para carregar o início"
          description={tela.erro ?? undefined}
          actionLabel="Tentar novamente"
          onAction={tela.recarregar}
        />
      )}

      {tela.status === 'pronto' && tela.dados && (
        <>
          {tela.semInternet && <AvisoSemInternet carregadoAs={tela.carregadoAs} />}
          <CartaoSaldo resumo={tela.dados} onPress={() => router.push('/caixa')} />

          <View testID="acoes-rapidas" style={styles.acoes}>
            <AcaoRapida label="Lançar" icon="adicionar" destaque onPress={() => router.push('/movimentacoes/nova')} />
            <AcaoRapida label="Dívidas" icon="dividas" onPress={() => router.push('/dividas')} />
            <AcaoRapida label="Categorias" icon="categorias" onPress={() => router.push('/categorias')} />
            <AcaoRapida label="Pagamentos" icon="formasPagamento" onPress={() => router.push('/formas-pagamento')} />
          </View>

          <SecaoPedeAtencao
            itens={pedeAtencao({ ...tela.dados, hoje })}
            textoVazio="Nada vence nos próximos 7 dias."
          />

          <ListSection label="Últimas movimentações">
            {tela.dados.ultimasMovimentacoes.length === 0 ? (
              <ListItem title="Nenhuma movimentação neste mês" subtitle="Toque em Lançar para registrar a primeira." />
            ) : (
              tela.dados.ultimasMovimentacoes.map((movimentacao) => (
                <ListItem
                  key={movimentacao.id}
                  title={movimentacao.descricao}
                  subtitle={subtituloMovimentacao(movimentacao, hoje)}
                  trailing={<ValorDaMovimentacao movimentacao={movimentacao} />}
                  onPress={() => router.push(`/movimentacoes/${movimentacao.id}/editar`)}
                />
              ))
            )}
            <ListItem title="Ver todas as movimentações" onPress={() => router.push('/movimentacoes')} />
          </ListSection>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  mes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.base,
  },
  acoes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
