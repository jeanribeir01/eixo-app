import { Button, Column, Input } from '@/ui';

import { hojeISO, isoParaDataBR, mascararData } from '@/lib/datas';

type CampoDataProps = {
  label: string;
  // Texto como o usuário vê (DD/MM/AAAA, possivelmente incompleto); o schema valida no salvar.
  value: string;
  onChange: (texto: string) => void;
  error?: string;
};

// Sem calendário nativo (decisão da EIX-33): campo com máscara e atalho para o dia de hoje,
// que é o caso mais comum ao lançar um pagamento.
export function CampoData({ label, value, onChange, error }: CampoDataProps) {
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
      <Column align="start">
        <Button label="Hoje" variant="ghost" onPress={() => onChange(isoParaDataBR(hojeISO()))} />
      </Column>
    </Column>
  );
}
