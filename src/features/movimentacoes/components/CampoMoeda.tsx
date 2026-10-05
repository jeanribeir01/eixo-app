import { Input } from '@/ui';

import { digitosParaCentavos, formatarMoeda } from '@/lib/money';

type CampoMoedaProps = {
  label: string;
  valorCentavos: number;
  onChange: (centavos: number) => void;
  error?: string;
};

// Campo "estilo caixa eletrônico": o usuário só digita números e eles entram pela direita
// (1 → R$ 0,01, 12 → R$ 0,12, 1234 → R$ 12,34). O estado é sempre centavos inteiros.
export function CampoMoeda({ label, valorCentavos, onChange, error }: CampoMoedaProps) {
  return (
    <Input
      label={label}
      value={valorCentavos === 0 ? '' : formatarMoeda(valorCentavos)}
      placeholder="R$ 0,00"
      keyboardType="number-pad"
      onChangeText={(texto) => onChange(digitosParaCentavos(texto))}
      error={error}
    />
  );
}
