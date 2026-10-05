import { Card, Text } from '@/ui';

import { formatarMoedaComSinal, tomDoValor } from './formatadores';

// Cartão de destaque do topo (um por tela): o número que o gestor abre o app para ver.
export function SaldoAtualCard({ saldoAtualCentavos }: { saldoAtualCentavos: number }) {
  return (
    <Card>
      <Text variant="bodySm" tone="body">
        Saldo atual
      </Text>
      <Text variant="display" tone={tomDoValor(saldoAtualCentavos)}>
        {formatarMoedaComSinal(saldoAtualCentavos)}
      </Text>
      <Text variant="caption" tone="muted">
        Considera só movimentações pagas.
      </Text>
    </Card>
  );
}
