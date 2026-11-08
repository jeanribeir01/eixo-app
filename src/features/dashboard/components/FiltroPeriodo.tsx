import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { isoParaDataBR } from '@/lib/datas';
import { Button, CampoData, Column, Tabs, Text } from '@/ui';

import { anoAtual, deslocarAno, deslocarMes, mesAtual, rotuloDoPeriodo, type ModoPeriodo, type Periodo } from '../periodo';
import { periodoCustomizadoSchema } from '../schema';

const OPCOES: { label: string; value: ModoPeriodo }[] = [
  { label: 'Mês', value: 'mes' },
  { label: 'Ano', value: 'ano' },
  { label: 'Período', value: 'customizado' },
];

type FiltroPeriodoProps = {
  value: Periodo;
  onChange: (periodo: Periodo) => void;
};

type Erros = { dataInicial?: string; dataFinal?: string };

// Filtro de data dos dashboards (US11). Mora fora de `kpis/` porque as US12 e US13 reutilizam o mesmo
// componente. Só escolhe o período; quem consulta os dados é a tela que o usa.
export function FiltroPeriodo({ value, onChange }: FiltroPeriodoProps) {
  // A aba não é derivada de `value`: abrir "Período" ainda não muda o filtro, só depois de "Aplicar".
  const [modo, setModo] = useState<ModoPeriodo>(value.modo);
  const [textoInicial, setTextoInicial] = useState(isoParaDataBR(value.dataInicial));
  const [textoFinal, setTextoFinal] = useState(isoParaDataBR(value.dataFinal));
  const [erros, setErros] = useState<Erros>({});

  function trocarModo(valor: string) {
    const novo = OPCOES.find((opcao) => opcao.value === valor)?.value;
    if (!novo) return;

    setModo(novo);
    setErros({});

    if (novo === 'customizado') {
      // Começa do período em uso: quase sempre o usuário só ajusta uma das pontas.
      setTextoInicial(isoParaDataBR(value.dataInicial));
      setTextoFinal(isoParaDataBR(value.dataFinal));
      return;
    }

    // Voltar à aba que já está aplicada não pode perder o mês ou o ano que o usuário navegou.
    if (novo !== value.modo) onChange(novo === 'mes' ? mesAtual() : anoAtual());
  }

  function aplicar() {
    const resultado = periodoCustomizadoSchema.safeParse({ dataInicial: textoInicial, dataFinal: textoFinal });
    if (!resultado.success) {
      const camposComErro = z.flattenError(resultado.error).fieldErrors;
      setErros({ dataInicial: camposComErro.dataInicial?.[0], dataFinal: camposComErro.dataFinal?.[0] });
      return;
    }

    setErros({});
    onChange({ modo: 'customizado', ...resultado.data });
  }

  const unidade = modo === 'mes' ? 'mês' : 'ano';
  const deslocar = modo === 'mes' ? deslocarMes : deslocarAno;

  return (
    <Column gap="md">
      <Tabs options={OPCOES} value={modo} onChange={trocarModo} accessibilityLabel="Tipo de período" />

      {modo === 'customizado' ? (
        <Column gap="md">
          <CampoData label="Data inicial" value={textoInicial} onChange={setTextoInicial} error={erros.dataInicial} />
          <CampoData label="Data final" value={textoFinal} onChange={setTextoFinal} error={erros.dataFinal} />
          {/* Ghost: o único cyan preenchido da tela fica para a ação primária dela (DESIGN_CYAN §1). */}
          <Column align="start">
            <Button label="Aplicar período" variant="ghost" onPress={aplicar} />
          </Column>
        </Column>
      ) : (
        <View style={styles.navegacao}>
          <Button
            variant="icon"
            icon="voltarMes"
            label={modo === 'mes' ? 'Mês anterior' : 'Ano anterior'}
            onPress={() => onChange(deslocar(value, -1))}
          />
          <Text accessibilityLiveRegion="polite">{rotuloDoPeriodo(value)}</Text>
          <Button
            variant="icon"
            icon="avancarMes"
            label={`Próximo ${unidade}`}
            onPress={() => onChange(deslocar(value, 1))}
          />
        </View>
      )}
    </Column>
  );
}

// Só layout: as setas nas pontas e o período no centro, em qualquer largura de tela.
const styles = StyleSheet.create({
  navegacao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
