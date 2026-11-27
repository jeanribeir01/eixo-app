import { useRouter } from 'expo-router';

import { ValorDaMovimentacao } from '@/features/movimentacoes/components/ValorDaMovimentacao';
import type { Movimentacao } from '@/features/movimentacoes/types';
import { diasEntre, isoParaDataBR } from '@/lib/datas';
import { ListItem, ListSection } from '@/ui';

// "Vence hoje", "Vence amanhã", "Vence 30/11". "Venceu" cobre o caso de a lista ficar aberta de um dia
// para o outro.
export function quandoVence(vencimento: string, hoje: string): string {
  const dias = diasEntre(hoje, vencimento);
  if (dias < 0) return `Venceu ${isoParaDataBR(vencimento).slice(0, 5)}`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  return `Vence ${isoParaDataBR(vencimento).slice(0, 5)}`;
}

type ProximosVencimentosProps = {
  movimentacoes: Movimentacao[];
  vencidos: number;
  hoje: string;
};

// O que vence primeiro, a pagar e a receber juntos. É a lista de trabalho de quem cuida do caixa; o
// Início só mostra o total dos próximos 7 dias. Os já vencidos viram uma linha só no topo: listados um a
// um, eles tomavam a lista inteira e escondiam o que vence de verdade.
export function ProximosVencimentos({ movimentacoes, vencidos, hoje }: ProximosVencimentosProps) {
  const router = useRouter();

  return (
    <ListSection label="Próximos vencimentos">
      {vencidos > 0 && (
        <ListItem
          icon="alerta"
          title={vencidos === 1 ? '1 vencido sem baixa' : `${vencidos} vencidos sem baixa`}
          subtitle="Confira e dê baixa em Movimentações"
          onPress={() => router.push('/movimentacoes')}
        />
      )}
      {movimentacoes.length === 0 ? (
        <ListItem title="Nada para vencer daqui para frente" subtitle="Contas a pagar e a receber aparecem aqui." />
      ) : (
        movimentacoes.map((movimentacao) => {
          const entrada = movimentacao.categoria.tipo === 'Entrada';
          return (
            <ListItem
              key={movimentacao.id}
              icon={entrada ? 'entrada' : 'saida'}
              title={movimentacao.descricao}
              // O repositório só traz pendentes com vencimento; o `?? hoje` só cobre o tipo, que aceita nulo.
              subtitle={[quandoVence(movimentacao.data_vencimento ?? hoje, hoje), movimentacao.categoria.titulo].join(' · ')}
              trailing={<ValorDaMovimentacao movimentacao={movimentacao} rotulo={entrada ? 'A receber' : 'A pagar'} />}
              onPress={() => router.push(`/movimentacoes/${movimentacao.id}/editar`)}
            />
          );
        })
      )}
      <ListItem title="Ver todas as movimentações" onPress={() => router.push('/movimentacoes')} />
    </ListSection>
  );
}
