import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Column, Input, Text, spacing } from '@/ui';

import { dataBRParaISO, dataLocalISO, hojeISO, isoParaDataBR, mascararData } from '@/lib/datas';

type CampoDataProps = {
  label: string;
  // Texto como o usuário vê (DD/MM/AAAA, possivelmente incompleto); o schema valida no salvar.
  value: string;
  onChange: (texto: string) => void;
  error?: string;
};

// O calendário abre na data do campo; com o campo vazio (ou uma data inválida), abre em hoje.
function dataInicial(value: string): Date {
  const iso = dataBRParaISO(value);
  if (!iso) return new Date();
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

// No Android o campo abre o calendário nativo (EIX-65); no iOS continua a máscara, porque o app é só
// Android nesta fase (AD-003). Nos dois, o atalho "Hoje" fica: é o caso mais comum ao lançar um pagamento.
// As props não mudam, então os formulários de Movimentação e Dívida usam o campo sem edição.
export function CampoData({ label, value, onChange, error }: CampoDataProps) {
  const botaoHoje = (
    <Column align="start">
      <Button label="Hoje" variant="ghost" onPress={() => onChange(isoParaDataBR(hojeISO()))} />
    </Column>
  );

  if (Platform.OS !== 'android') {
    return (
      <Column gap="xs">
        <Input
          label={label}
          value={value}
          placeholder="DD/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(texto) => onChange(mascararData(texto))}
          error={error}
        />
        {botaoHoje}
      </Column>
    );
  }

  function abrirCalendario() {
    DateTimePickerAndroid.open({
      value: dataInicial(value),
      mode: 'date',
      // Cancelar devolve "dismissed" e o valor anterior fica como estava.
      onChange: (evento, data) => {
        if (evento.type === 'set' && data) onChange(isoParaDataBR(dataLocalISO(data)));
      },
    });
  }

  return (
    <Column gap="xs">
      <View style={styles.linha}>
        {/* A linha inteira é um botão que abre o calendário. O Input só desenha o campo: fica fora do
            toque e do leitor de tela, que anuncia o rótulo e a data pelo botão. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: value || 'Nenhuma data' }}
          accessibilityHint="Abre o calendário"
          onPress={abrirCalendario}
          style={styles.campo}
        >
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants">
            <Input label={label} value={value} placeholder="DD/MM/AAAA" editable={false} />
          </View>
        </Pressable>
        {!!value && <Button variant="icon" icon="limpar" label="Limpar data" onPress={() => onChange('')} />}
      </View>
      {/* O erro fica fora da linha para o "Limpar data" continuar alinhado com o campo, não com a mensagem. */}
      {!!error && (
        <Text accessibilityRole="alert" variant="bodySm">
          {error}
        </Text>
      )}
      {botaoHoje}
    </Column>
  );
}

const styles = StyleSheet.create({
  // Alinhado pela base: o botão de 44pt fica na altura do campo, abaixo do rótulo.
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  campo: {
    flex: 1,
  },
});
