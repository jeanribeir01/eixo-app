import { Aviso } from '@/ui';

import { formatarMoedaComSinal } from '../formatadores';
import type { PendentesSemVencimento } from '../resumoCaixa';

// Bloco separado de propósito: sem vencimento não há mês onde encaixar a pendência, então ela fica fora
// da projeção mensal — mas o gestor precisa saber que esse dinheiro existe. Sem nenhuma, o bloco some.
export function PendentesSemDataCard({ semVencimento }: { semVencimento: PendentesSemVencimento }) {
  const { quantidade, entradasCentavos, saidasCentavos } = semVencimento;
  if (quantidade === 0) return null;

  // Só o que existe entra no texto: "+ R$ 500,00 a receber e − R$ 1.200,00 a pagar".
  const valores = [
    entradasCentavos > 0 ? `${formatarMoedaComSinal(entradasCentavos)} a receber` : null,
    saidasCentavos > 0 ? `${formatarMoedaComSinal(-saidasCentavos)} a pagar` : null,
  ].filter(Boolean);
  const uma = quantidade === 1;
  const quantas = uma ? '1 movimentação pendente não tem' : `${quantidade} movimentações pendentes não têm`;
  const ficam = uma ? 'fica' : 'ficam';
  const incluir = uma ? 'incluí-la' : 'incluí-las';

  return (
    <Aviso tom="warning" icone="calendario" titulo="Pendentes sem data">
      {`${quantas} data de vencimento e ${ficam} fora da projeção${valores.length > 0 ? `: ${valores.join(' e ')}` : ''}. Defina o vencimento para ${incluir}.`}
    </Aviso>
  );
}
