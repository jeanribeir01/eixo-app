import { Card, Column, Text } from '@/ui';

import { formatarMoedaComSinal, tomDoValor } from '../formatadores';
import type { PendentesSemVencimento } from '../resumoCaixa';

// Bloco separado de propósito: sem vencimento não há mês onde encaixar a pendência, então ela
// fica fora da projeção mensal — mas o gestor precisa saber que esse dinheiro existe.
export function PendentesSemDataCard({ semVencimento }: { semVencimento: PendentesSemVencimento }) {
  const { quantidade, entradasCentavos, saidasCentavos } = semVencimento;

  return (
    <Card>
      <Column gap="xs">
        <Text variant="subheading">Pendentes sem data de vencimento</Text>
        <Text variant="bodySm" tone="body">
          Não entram na projeção mensal.
        </Text>
      </Column>

      {quantidade === 0 ? (
        <Text tone="body">Nenhuma pendência sem data.</Text>
      ) : (
        <Column gap="xs">
          <Text>{quantidade === 1 ? '1 movimentação' : `${quantidade} movimentações`}</Text>
          <Column direction="row" gap="xs" wrap>
            <Text variant="bodySm" tone="body">
              Entradas:
            </Text>
            <Text variant="bodySm" tone={tomDoValor(entradasCentavos)}>
              {formatarMoedaComSinal(entradasCentavos)}
            </Text>
          </Column>
          <Column direction="row" gap="xs" wrap>
            <Text variant="bodySm" tone="body">
              Saídas:
            </Text>
            <Text variant="bodySm" tone={tomDoValor(-saidasCentavos)}>
              {formatarMoedaComSinal(-saidasCentavos)}
            </Text>
          </Column>
        </Column>
      )}
    </Card>
  );
}
