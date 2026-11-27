import { useRouter } from 'expo-router';

import { formatarPlaca } from '@/features/veiculos/placa';
import { ListItem, ListSection, type IconName } from '@/ui';

import type { SituacaoAgora, VeiculoAgora } from '../frotaAgora';

function haQuantosDias(dias: number): string {
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

// A frase da linha: o que o veículo está fazendo e o detalhe que ajuda a decidir. Cabe numa linha em 360:
// só o modelo, sem a marca ("Actros 2651"), e o trecho sem o motorista.
export function descreverSituacao({ veiculo, situacao }: VeiculoAgora): string {
  const { modelo } = veiculo;
  switch (situacao.tipo) {
    case 'estrada': {
      const { viagem } = situacao;
      if (!viagem) return 'Na estrada';
      const trecho = viagem.rota ? `${viagem.rota.cidade_origem} → ${viagem.rota.cidade_destino}` : null;
      return trecho ? `Na estrada · ${trecho}` : 'Na estrada';
    }
    case 'oficina': {
      const quando = situacao.dias === null ? 'Na oficina' : situacao.dias === 0 ? 'Na oficina desde hoje' : `Na oficina ${haQuantosDias(situacao.dias)}`;
      return [quando, situacao.manutencao?.descricao].filter(Boolean).join(' · ');
    }
    case 'parado': {
      if (situacao.dias === null) return `Disponível · ${modelo}`;
      if (situacao.dias === 0) return `Disponível desde hoje · ${modelo}`;
      return `Parado ${haQuantosDias(situacao.dias)} · ${modelo}`;
    }
  }
}

const ICONE: Record<SituacaoAgora['tipo'], IconName> = {
  estrada: 'viagens',
  oficina: 'manutencoes',
  parado: 'frota',
};

// Uma linha por veículo em operação; tocar abre o Detalhe do veículo (o histórico de manutenções),
// que antes só se alcançava pela lista de Manutenções.
export function VeiculosAgora({ veiculos }: { veiculos: VeiculoAgora[] }) {
  const router = useRouter();

  return (
    <ListSection label="Veículos agora">
      {veiculos.length === 0 ? (
        <ListItem title="Nenhum veículo em operação" subtitle="Cadastre a frota em Veículos." />
      ) : (
        veiculos.map((item) => (
          <ListItem
            key={item.veiculo.id}
            icon={ICONE[item.situacao.tipo]}
            title={formatarPlaca(item.veiculo.placa)}
            subtitle={descreverSituacao(item)}
            onPress={() => router.push(`/frota/${item.veiculo.id}`)}
          />
        ))
      )}
    </ListSection>
  );
}
