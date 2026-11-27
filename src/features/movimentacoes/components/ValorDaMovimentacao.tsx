import { StyleSheet, View } from 'react-native';

import { formatarMoeda } from '@/lib/money';
import { Text } from '@/ui';
import { spacing } from '@/ui/tokens';

import { rotuloStatus, type Movimentacao } from '../types';

// O lado direito de uma linha de movimentação no Início e na aba Caixa: o valor com o sinal e, embaixo,
// a situação. Cor nunca sozinha: o sinal + / − acompanha sempre (DESIGN_CYAN, cores semânticas).
// `rotulo` troca a situação quando ela já é óbvia na lista (só pendentes: "A pagar", "A receber").
export function ValorDaMovimentacao({ movimentacao, rotulo }: { movimentacao: Movimentacao; rotulo?: string }) {
  const entrada = movimentacao.categoria.tipo === 'Entrada';
  return (
    <View style={styles.valor}>
      <Text weight="medium" tone={entrada ? 'success' : 'danger'}>
        {`${entrada ? '+' : '−'} ${formatarMoeda(movimentacao.valorCentavos)}`}
      </Text>
      <Text variant="caption" tone="body">
        {rotulo ?? rotuloStatus(movimentacao.status_pagamento, movimentacao.categoria.tipo)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  valor: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
