import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { isoParaDataBR } from '@/lib/datas';
import { Button, CampoData, Column, Tabs, Text } from '@/ui';

import {
  converterPeriodo,
  deslocarAno,
  deslocarMes,
  mesmoPeriodo,
  rotuloDoPeriodo,
  type ModoPeriodo,
  type Periodo,
} from '../periodo';
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
  // A aba "Período" pode ficar aberta antes de ser aplicada: é o rascunho. Fora dele, a aba mostrada é
  // sempre a de `value`, para que aba, setas e rótulo nunca discordem do período que a tela usa.
  const [editandoRascunho, setEditandoRascunho] = useState(false);
  const [textoInicial, setTextoInicial] = useState(isoParaDataBR(value.dataInicial));
  const [textoFinal, setTextoFinal] = useState(isoParaDataBR(value.dataFinal));
  const [erros, setErros] = useState<Erros>({});

  // Quando o período muda (pelas setas, por "Aplicar" ou pela própria tela, como um reset), os campos
  // recomeçam dele e o rascunho fecha. Ajustar o estado durante o render, comparando com o valor
  // anterior, é o jeito que a documentação do React recomenda para isso (sem useEffect).
  const [periodoAnterior, setPeriodoAnterior] = useState(value);
  if (!mesmoPeriodo(value, periodoAnterior)) {
    setPeriodoAnterior(value);
    setEditandoRascunho(false);
    setTextoInicial(isoParaDataBR(value.dataInicial));
    setTextoFinal(isoParaDataBR(value.dataFinal));
    setErros({});
  }

  const modo: ModoPeriodo = editandoRascunho ? 'customizado' : value.modo;

  // Os campos mostram datas que os cards ainda não usam: o aviso diz qual período está valendo.
  const rascunhoPendente =
    modo === 'customizado' &&
    (value.modo !== 'customizado' ||
      textoInicial !== isoParaDataBR(value.dataInicial) ||
      textoFinal !== isoParaDataBR(value.dataFinal));

  function trocarModo(valor: string) {
    const novo = OPCOES.find((opcao) => opcao.value === valor)?.value;
    // Tocar na aba que já está aberta não faz nada: senão apagaria as datas digitadas.
    if (!novo || novo === modo) return;

    setErros({});

    if (novo === 'customizado') {
      // Começa do período em uso: quase sempre o usuário só ajusta uma das pontas.
      setTextoInicial(isoParaDataBR(value.dataInicial));
      setTextoFinal(isoParaDataBR(value.dataFinal));
      setEditandoRascunho(true);
      return;
    }

    setEditandoRascunho(false);
    // Fechar o rascunho e voltar à aba que já está aplicada mantém o mês ou o ano que o usuário navegou.
    if (novo !== value.modo) onChange(converterPeriodo(value, novo));
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
          {rascunhoPendente && (
            <Text variant="bodySm" tone="body" accessibilityLiveRegion="polite">
              {`Em uso: ${rotuloDoPeriodo(value)}. Toque em "Aplicar período" para trocar.`}
            </Text>
          )}
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
          {/* Mesmo estilo do navegador de mês de Movimentações. */}
          <Text variant="subheading" accessibilityLiveRegion="polite">
            {rotuloDoPeriodo(value)}
          </Text>
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
