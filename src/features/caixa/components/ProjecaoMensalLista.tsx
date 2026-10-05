import { Badge, Card, Column, ListItem, Text } from '@/ui';

import { formatarMes, formatarMoedaComSinal, tomDoValor } from '../formatadores';
import type { MesProjetado } from '../resumoCaixa';

type ProjecaoMensalListaProps = {
  meses: MesProjetado[];
  // Em tablet os valores de cada mês cabem numa linha só, como uma tabela.
  largo: boolean;
};

function Valor({ rotulo, centavos, destaque = false }: { rotulo: string; centavos: number; destaque?: boolean }) {
  return (
    <Column direction="row" gap="xs" wrap>
      <Text variant="bodySm" tone="body">
        {rotulo}:
      </Text>
      <Text variant="bodySm" tone={tomDoValor(centavos)} weight={destaque ? 'medium' : 'regular'}>
        {formatarMoedaComSinal(centavos)}
      </Text>
    </Column>
  );
}

export function ProjecaoMensalLista({ meses, largo }: ProjecaoMensalListaProps) {
  return (
    <Card>
      <Text variant="subheading">Projeção de caixa</Text>

      {meses.length === 0 ? (
        <Text tone="body">Nenhuma pendência com data de vencimento.</Text>
      ) : (
        <Column gap="xs">
          {meses.map((mes) => {
            const negativo = mes.saldoProjetadoCentavos < 0;
            return (
              <ListItem key={mes.mes}>
                <Column gap="xs">
                  <Column direction="row" gap="sm" align="center" wrap>
                    <Text weight="medium">{formatarMes(mes.mes)}</Text>
                    {/* Alerta com glifo + rótulo: a cor vermelha nunca é o único indicador. */}
                    {negativo && <Badge tone="danger" label="⚠ Saldo negativo" />}
                  </Column>
                  <Column direction={largo ? 'row' : 'column'} gap={largo ? 'lg' : 'xs'} wrap>
                    <Valor rotulo="Entradas pendentes" centavos={mes.entradasPendentesCentavos} />
                    {/* A view devolve a saída como valor positivo; aqui ela só ganha o sinal de saída. */}
                    <Valor rotulo="Saídas pendentes" centavos={-mes.saidasPendentesCentavos} />
                    <Valor rotulo="Saldo projetado" centavos={mes.saldoProjetadoCentavos} destaque />
                  </Column>
                </Column>
              </ListItem>
            );
          })}
        </Column>
      )}
    </Card>
  );
}
