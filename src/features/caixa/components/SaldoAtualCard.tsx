import { Card, Text } from '@/ui';

import { formatarMoedaComSinal, tomDoValor } from '../formatadores';

type SaldoAtualCardProps = {
  saldoAtualCentavos: number;
  // No hub Financeiro o cartão inteiro abre Saldo e projeção (EIX-62).
  onPress?: () => void;
};

// Cartão de destaque do topo (um por tela): o número que o gestor abre o app para ver.
export function SaldoAtualCard({ saldoAtualCentavos, onPress }: SaldoAtualCardProps) {
  const saldo = formatarMoedaComSinal(saldoAtualCentavos);

  return (
    <Card
      variant="feature"
      onPress={onPress}
      // Tocável, o leitor de tela anuncia o valor e para onde o toque leva, numa frase só.
      accessibilityLabel={onPress ? `Saldo atual ${saldo}. Ver saldo e projeção` : undefined}
    >
      <Text variant="bodySm" tone="body">
        Saldo atual
      </Text>
      <Text variant="display" tone={tomDoValor(saldoAtualCentavos)}>
        {saldo}
      </Text>
      <Text variant="caption" tone="muted">
        Considera só movimentações pagas.
      </Text>
    </Card>
  );
}
