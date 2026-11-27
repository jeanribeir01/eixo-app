import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Aviso, Badge, Button, Column, ListItem, ListSection, Tabs, Text, spacing } from '@/ui';

import { formatarMes, formatarMoedaComSinal, tomDoValor } from '../formatadores';
import { primeiroMesNegativo, separarJanela } from '../projecao';
import type { AnoProjetado, MesProjetado } from '../resumoCaixa';
import { GraficoSaldoProjetado, type PontoDoGrafico } from './GraficoSaldoProjetado';

type Aba = 'meses' | 'anos';

// Filtro de período do DESIGN_CYAN (Tab Pill Group). Uma dívida de 80 parcelas não vira 80 linhas:
// a aba padrão mostra só o próximo ano, e o resto aparece somado por ano (EIX-74).
const ABAS: { value: Aba; label: string }[] = [
  { value: 'meses', label: '12 meses' },
  { value: 'anos', label: 'Por ano' },
];

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// '2027-03' → 'mar'. Embaixo da barra só cabe o mês curto; o nome completo vai para o leitor de tela.
function mesCurto(mes: string): string {
  return MESES_CURTOS[Number(mes.split('-')[1]) - 1] ?? mes;
}

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
        {/* Saldo negativo já vem com "−" e vermelho. O selo fica para quando o valor mostrado é positivo
            mas o caixa ficou negativo no meio do período (ano que fecha no azul). */}
        {negativo && saldoCentavos >= 0 && (
          <View style={styles.selo}>
            <Badge tone="danger" label="Negativo em algum mês" />
          </View>
        )}
      </Column>
    </ListItem>
  );
}

export function ProjecaoCaixa({ mesReferencia, meses, anos }: ProjecaoCaixaProps) {
  const [aba, setAba] = useState<Aba>('meses');

  const cabecalho = (
    <Text variant="subheading" weight="semibold" accessibilityRole="header">
      Projeção de caixa
    </Text>
  );

  if (meses.length === 0) {
    return (
      <Column gap="sm">
        {cabecalho}
        <Text tone="body">Nenhuma pendência com data de vencimento.</Text>
      </Column>
    );
  }

  const { proximos, mesesDepois, ultimoMes } = separarJanela(meses, mesReferencia);
  const mesNegativo = primeiroMesNegativo(meses);

  const pontos: PontoDoGrafico[] =
    aba === 'meses'
      ? proximos.map((item) => ({
          chave: item.mes,
          rotulo: mesCurto(item.mes),
          titulo: formatarMes(item.mes),
          centavos: item.saldoProjetadoCentavos,
        }))
      : anos.map((item) => ({
          chave: String(item.ano),
          rotulo: String(item.ano),
          titulo: String(item.ano),
          centavos: item.saldoFimDoAnoCentavos,
        }));

  const primeiro = proximos[0];
  const ultimo = proximos.at(-1);
  const legenda =
    aba === 'anos'
      ? 'Saldo projetado no fim de cada ano.'
      : primeiro && ultimo
        ? `${formatarMes(primeiro.mes)} a ${formatarMes(ultimo.mes).toLowerCase()} · saldo previsto no fim de cada mês`
        : null;

  return (
    <Column gap="md">
      {cabecalho}

      {/* O alerta olha a projeção inteira, não só a janela: o problema pode estar daqui a três anos. */}
      {mesNegativo && (
        <Aviso tom="danger" icone="alerta" titulo={`O saldo fica negativo em ${formatarMes(mesNegativo).toLowerCase()}`}>
          A projeção soma ao saldo atual as entradas e saídas pendentes, mês a mês.
        </Aviso>
      )}

      <Tabs
        accessibilityLabel="Período da projeção"
        options={ABAS}
        value={aba}
        onChange={(valor) => setAba(valor === 'anos' ? 'anos' : 'meses')}
      />

      {legenda && (
        <Text variant="bodySm" tone="body">
          {legenda}
        </Text>
      )}

      {pontos.length > 0 && <GraficoSaldoProjetado pontos={pontos} />}

      {aba === 'meses' ? (
        <Column gap="sm">
          {proximos.length === 0 ? (
            <Text tone="body">Nenhuma pendência nos próximos 12 meses.</Text>
          ) : (
            <ListSection>
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
            </ListSection>
          )}
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
        <ListSection>
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
        </ListSection>
      )}
    </Column>
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
  selo: {
    alignSelf: 'flex-start',
  },
});
