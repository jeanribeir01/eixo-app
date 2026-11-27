import { StyleSheet, View } from 'react-native';

import { formatarMoeda } from '@/lib/money';
import { Card, Column, Text } from '@/ui';
import { colors, radius, spacing } from '@/ui/tokens';

import { formatarMes, formatarMoedaComSinal, tomDoValor } from '../formatadores';
import type { MesEmAndamento } from '../mesEmAndamento';

type BarraProps = {
  feitoCentavos: number;
  previstoCentavos: number;
  tom: 'success' | 'danger';
};

// Quanto do previsto já aconteceu. A barra é só reforço visual: o texto ao lado diz os mesmos números
// (cor nunca sozinha), por isso ela fica fora do leitor de tela.
function BarraDoMes({ feitoCentavos, previstoCentavos, tom }: BarraProps) {
  const fracao = previstoCentavos > 0 ? Math.min(feitoCentavos / previstoCentavos, 1) : 0;
  return (
    <View
      testID={`barra-${tom === 'success' ? 'entradas' : 'saidas'}`}
      style={styles.trilho}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.preenchido, { width: `${fracao * 100}%`, backgroundColor: colors[tom] }]} />
    </View>
  );
}

type LinhaProps = {
  rotulo: 'Entradas' | 'Saídas';
  pagoCentavos: number;
  pendenteCentavos: number;
};

function LinhaDoMes({ rotulo, pagoCentavos, pendenteCentavos }: LinhaProps) {
  const entrada = rotulo === 'Entradas';
  const previsto = pagoCentavos + pendenteCentavos;
  const falta =
    pendenteCentavos === 0
      ? entrada
        ? 'Tudo recebido'
        : 'Tudo pago'
      : `Falta ${entrada ? 'receber' : 'pagar'} ${formatarMoeda(pendenteCentavos)}`;

  return (
    <Column gap="xs">
      <View style={styles.cabecalhoLinha}>
        <Text variant="bodySm" weight="medium">
          {rotulo}
        </Text>
        <Text variant="bodySm" tone="body">
          {`${formatarMoeda(pagoCentavos)} de ${formatarMoeda(previsto)}`}
        </Text>
      </View>
      <BarraDoMes feitoCentavos={pagoCentavos} previstoCentavos={previsto} tom={entrada ? 'success' : 'danger'} />
      <Text variant="caption" tone="body">
        {falta}
      </Text>
    </Column>
  );
}

type MesEmAndamentoCardProps = {
  mes: MesEmAndamento;
  onPress: () => void;
};

// Cartão de destaque da aba Caixa (um por tela). O saldo já está no Início; aqui a pergunta é outra:
// como o mês vai fechar. "Previsto" = o que já foi pago + o que ainda está pendente no mês (o vencido e
// não pago entra no mês atual, regra da RPC `resumo_caixa`).
export function MesEmAndamentoCard({ mes, onPress }: MesEmAndamentoCardProps) {
  // A única conta da tela: a diferença entre os dois totais que o banco já somou.
  const resultadoCentavos =
    mes.entradasPagasCentavos + mes.entradasPendentesCentavos - (mes.saidasPagasCentavos + mes.saidasPendentesCentavos);
  const nomeDoMes = formatarMes(mes.mes).split(' de ')[0];
  const resultado = formatarMoedaComSinal(resultadoCentavos);

  return (
    <Card
      variant="feature"
      onPress={onPress}
      accessibilityLabel={`${nomeDoMes}, resultado previsto ${resultado}. Ver movimentações`}
    >
      <Text variant="bodySm" tone="body">
        {`${nomeDoMes} · resultado previsto`}
      </Text>
      <Text
        variant="numeric"
        weight="semibold"
        tone={tomDoValor(resultadoCentavos)}
        // Valor na casa dos milhões não quebra linha: a fonte encolhe para caber em 360 de largura.
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {resultado}
      </Text>
      <LinhaDoMes rotulo="Entradas" pagoCentavos={mes.entradasPagasCentavos} pendenteCentavos={mes.entradasPendentesCentavos} />
      <LinhaDoMes rotulo="Saídas" pagoCentavos={mes.saidasPagasCentavos} pendenteCentavos={mes.saidasPendentesCentavos} />
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecalhoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  trilho: {
    height: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  preenchido: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
