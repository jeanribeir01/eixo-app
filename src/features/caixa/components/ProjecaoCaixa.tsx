import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Column, ListItem, Tabs, Text, spacing } from '@/ui';

import { formatarMes, formatarMoedaComSinal, tomDoValor } from '../formatadores';
import { primeiroMesNegativo, separarJanela } from '../projecao';
import type { AnoProjetado, MesProjetado } from '../resumoCaixa';

type Aba = 'meses' | 'anos';

// Filtro de período do DESIGN_CYAN (Tab Pill Group). Uma dívida de 80 parcelas não vira 80 linhas:
// a aba padrão mostra só o próximo ano, e o resto aparece somado por ano (EIX-74).
const ABAS: { value: Aba; label: string }[] = [
  { value: 'meses', label: '12 meses' },
  { value: 'anos', label: 'Por ano' },
];

type ProjecaoCaixaProps = {
  mesReferencia: string;
  meses: MesProjetado[];
  anos: AnoProjetado[];
};

function Valor({ rotulo, centavos }: { rotulo: string; centavos: number }) {
  return (
    <Column direction="row" gap="xs">
      <Text variant="bodySm" tone="body">
        {rotulo}
      </Text>
      <Text variant="bodySm" tone={tomDoValor(centavos)}>
        {formatarMoedaComSinal(centavos)}
      </Text>
    </Column>
  );
}

type LinhaProjecaoProps = {
  titulo: string;
  entradasCentavos: number;
  saidasCentavos: number;
  saldoCentavos: number;
  negativo: boolean;
};

// Uma linha por período: título e saldo projetado em cima; entradas e saídas embaixo, quebrando
// linha em vez de cortar (nenhum valor fica escondido). Valor zero não aparece.
function LinhaProjecao({ titulo, entradasCentavos, saidasCentavos, saldoCentavos, negativo }: LinhaProjecaoProps) {
  return (
    <ListItem>
      <Column gap="xs">
        <View style={styles.topoDaLinha}>
          <Text weight="medium" style={styles.titulo}>
            {titulo}
          </Text>
          <Text weight="medium" tone={tomDoValor(saldoCentavos)}>
            {formatarMoedaComSinal(saldoCentavos)}
          </Text>
        </View>
        <Column direction="row" gap="md" wrap>
          {entradasCentavos > 0 && <Valor rotulo="Entradas" centavos={entradasCentavos} />}
          {/* O banco devolve a saída positiva; aqui ela só ganha o sinal de saída. */}
          {saidasCentavos > 0 && <Valor rotulo="Saídas" centavos={-saidasCentavos} />}
        </Column>
        {/* Glifo + rótulo: a cor vermelha nunca é o único indicador. */}
        {negativo && <Badge tone="danger" label="⚠ Saldo negativo" />}
      </Column>
    </ListItem>
  );
}

export function ProjecaoCaixa({ mesReferencia, meses, anos }: ProjecaoCaixaProps) {
  const [aba, setAba] = useState<Aba>('meses');

  if (meses.length === 0) {
    return (
      <Card>
        <Text variant="subheading">Projeção de caixa</Text>
        <Text tone="body">Nenhuma pendência com data de vencimento.</Text>
      </Card>
    );
  }

  const { proximos, mesesDepois, ultimoMes } = separarJanela(meses, mesReferencia);
  const mesNegativo = primeiroMesNegativo(meses);

  return (
    <Card>
      <Text variant="subheading">Projeção de caixa</Text>

      {mesNegativo && <Badge tone="danger" label={`⚠ O saldo fica negativo em ${formatarMes(mesNegativo).toLowerCase()}`} />}

      <Tabs
        accessibilityLabel="Período da projeção"
        options={ABAS}
        value={aba}
        onChange={(valor) => setAba(valor === 'anos' ? 'anos' : 'meses')}
      />

      {aba === 'meses' ? (
        <Column gap="xs">
          {proximos.length === 0 && <Text tone="body">Nenhuma pendência nos próximos 12 meses.</Text>}
          {proximos.map((item) => (
            <LinhaProjecao
              key={item.mes}
              titulo={formatarMes(item.mes)}
              entradasCentavos={item.entradasPendentesCentavos}
              saidasCentavos={item.saidasPendentesCentavos}
              saldoCentavos={item.saldoProjetadoCentavos}
              negativo={item.saldoProjetadoCentavos < 0}
            />
          ))}
          {ultimoMes && (
            <Column gap="sm">
              <Text variant="bodySm" tone="body">
                {`Mais ${mesesDepois} ${mesesDepois === 1 ? 'mês' : 'meses'} com pendências até ${formatarMes(ultimoMes).toLowerCase()}.`}
              </Text>
              <Button label="Ver por ano" variant="ghost" onPress={() => setAba('anos')} />
            </Column>
          )}
        </Column>
      ) : (
        <Column gap="xs">
          <Text variant="bodySm" tone="body">
            Saldo projetado no fim de cada ano.
          </Text>
          {anos.map((item) => (
            <LinhaProjecao
              key={item.ano}
              titulo={String(item.ano)}
              entradasCentavos={item.entradasPendentesCentavos}
              saidasCentavos={item.saidasPendentesCentavos}
              saldoCentavos={item.saldoFimDoAnoCentavos}
              // Vale o pior mês do ano: o caixa pode ficar negativo no meio e terminar positivo.
              negativo={item.menorSaldoCentavos < 0}
            />
          ))}
        </Column>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  topoDaLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // O título encolhe antes do saldo: o valor nunca é cortado.
  titulo: {
    flexShrink: 1,
  },
});
