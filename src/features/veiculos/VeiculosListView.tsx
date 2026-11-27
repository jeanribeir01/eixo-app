import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  CampoBusca,
  ChipFiltro,
  Column,
  EmptyState,
  FAB,
  FAB_ALTURA_RESERVADA,
  GrupoRecolhivel,
  LinhaDeFiltros,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Text,
  spacing,
  useScreenColumn,
  type IconName,
} from '@/ui';

import { formatarPlaca } from './placa';
import { listarVeiculos } from './repository';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo, type Veiculo } from './types';

type Status = 'carregando' | 'pronto' | 'erro';

// Grupos na ordem em que o gestor olha a frota: o que está rodando, o que pode sair, o que está parado. O
// status vem do cabeçalho do grupo (critério da US06: o status aparece em cada veículo, agora pelo grupo).
// Os desativados não entram aqui: ficam no grupo recolhido do fim, como nas outras listas de cadastro.
const GRUPOS: { status: StatusVeiculo; rotulo: string; icone: IconName }[] = [
  { status: 'EmViagem', rotulo: 'Em viagem', icone: 'viagens' },
  { status: 'Disponivel', rotulo: 'Disponíveis', icone: 'frota' },
  { status: 'EmManutencao', rotulo: 'Em manutenção', icone: 'manutencoes' },
];

// Cabeçalhos e veículos numa FlatList só, como Viagens e Movimentações: a lista continua virtualizada.
type Linha = { tipo: 'grupo'; id: string; rotulo: string } | { tipo: 'veiculo'; id: string; veiculo: Veiculo };

function agruparPorStatus(veiculos: Veiculo[]): Linha[] {
  const linhas: Linha[] = [];
  for (const { status, rotulo } of GRUPOS) {
    const doGrupo = veiculos.filter((veiculo) => veiculo.status === status);
    if (doGrupo.length === 0) continue;
    linhas.push({ tipo: 'grupo', id: `grupo-${status}`, rotulo: `${rotulo} · ${doGrupo.length}` });
    for (const veiculo of doGrupo) linhas.push({ tipo: 'veiculo', id: veiculo.id, veiculo });
  }
  return linhas;
}

const TODOS = 'Todos';

// Sem "Desativado" no filtro: os desativados aparecem sempre no grupo recolhido do fim da lista.
const opcoesFiltro = [
  { label: TODOS, value: TODOS },
  ...STATUS_VEICULO.filter((status) => status !== 'Inativo').map((status) => ({
    label: rotuloStatusVeiculo[status],
    value: status,
  })),
];

// Espera o usuário parar de digitar antes de ir ao banco: sem isso, cada letra vira uma query.
const ATRASO_BUSCA_MS = 300;

function formatarCapacidade(toneladas: number): string {
  return `${toneladas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`;
}

export function VeiculosListView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>(TODOS);
  // Descarta respostas fora de ordem: se o usuário troca o filtro rápido, só a última vale.
  const ultimaRequisicao = useRef(0);
  const coluna = useScreenColumn();

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAplicada(busca), ATRASO_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(async () => {
    const requisicao = ++ultimaRequisicao.current;
    setStatus('carregando');

    const resultado = await listarVeiculos({
      busca: buscaAplicada.trim() || undefined,
      status: filtroStatus === TODOS ? undefined : (filtroStatus as StatusVeiculo),
    });
    if (requisicao !== ultimaRequisicao.current) return;

    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setVeiculos(resultado.data);
    setStatus('pronto');
  }, [buscaAplicada, filtroStatus]);

  // Recarrega ao voltar da criação/edição (a tela não desmonta na pilha) e quando busca/filtro mudam.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const filtrando = buscaAplicada.trim() !== '' || filtroStatus !== TODOS;
  const linhas = useMemo(() => agruparPorStatus(veiculos), [veiculos]);
  const desativados = useMemo(() => veiculos.filter((veiculo) => veiculo.status === 'Inativo'), [veiculos]);
  const editar = (id: string) => router.push(`/frota/${id}/editar`);

  return (
    // Tela interna, aberta pelo hub de Frota (EIX-77): o título "Veículos" vem do header nativo.
    <Screen
      underHeader
      list
      // O FAB é a ação de criar e o único azul preenchido da tela, como nas outras listas (DESIGN_CYAN §7).
      fab={<FAB label="Novo veículo" onPress={() => router.push('/frota/novo')} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <CampoBusca placeholder="Buscar por placa ou modelo" value={busca} onChangeText={setBusca} />

        {/* Chip no lugar da fileira de abas: cinco status não cabem lado a lado em 360 (referência
            Nubank do redesign). */}
        <LinhaDeFiltros accessibilityLabel="Filtros">
          <ChipFiltro label="Status" value={filtroStatus} valorPadrao={TODOS} options={opcoesFiltro} onChange={setFiltroStatus} />
        </LinhaDeFiltros>

        {status === 'carregando' && (
          <Column gap="sm">
            <Skeleton height="xxl" accessibilityLabel="Carregando veículos" />
            <Skeleton height="xxl" />
            <Skeleton height="xxl" />
          </Column>
        )}

        {status === 'erro' && (
          <EmptyState title="Não foi possível carregar" description={erro ?? undefined} actionLabel="Tentar novamente" onAction={carregar} />
        )}

        {status === 'pronto' && veiculos.length === 0 && (
          <EmptyState
            title={filtrando ? 'Nenhum veículo encontrado' : 'Nenhum veículo cadastrado'}
            description={filtrando ? 'Tente outra placa, modelo ou status.' : 'Cadastre o primeiro veículo da frota.'}
            actionLabel={filtrando ? undefined : 'Novo veículo'}
            onAction={filtrando ? undefined : () => router.push('/frota/novo')}
          />
        )}
      </ScreenColumn>

      {status === 'pronto' && veiculos.length > 0 && (
        <List
          data={linhas}
          keyExtractor={(linha) => linha.id}
          style={styles.lista}
          contentContainerStyle={[coluna, styles.espacoDoFab]}
          renderItem={({ item }) =>
            item.tipo === 'grupo' ? (
              <View style={styles.grupo}>
                <Text weight="semibold" accessibilityRole="header">
                  {item.rotulo}
                </Text>
              </View>
            ) : (
              <LinhaDoVeiculo veiculo={item.veiculo} onEditar={() => editar(item.veiculo.id)} />
            )
          }
          // Desativados no fim, recolhidos: continuam no histórico de viagens e abrem para reativar.
          ListFooterComponent={
            desativados.length > 0 ? (
              <GrupoRecolhivel
                rotulo="Desativados"
                quantidade={desativados.length}
                resumo={desativados.map((veiculo) => formatarPlaca(veiculo.placa)).join(', ')}
              >
                {desativados.map((veiculo) => (
                  <LinhaDoVeiculo key={veiculo.id} veiculo={veiculo} onEditar={() => editar(veiculo.id)} />
                ))}
              </GrupoRecolhivel>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}

type LinhaDoVeiculoProps = {
  veiculo: Veiculo;
  onEditar: () => void;
};

// Uma linha por veículo: tocar edita. Desativar e reativar ficam no Editar, como nas outras listas de
// cadastro (antes era um "Mais opções" na linha, com o Alert do sistema).
function LinhaDoVeiculo({ veiculo, onEditar }: LinhaDoVeiculoProps) {
  const placa = formatarPlaca(veiculo.placa);
  const icone = GRUPOS.find((grupo) => grupo.status === veiculo.status)?.icone ?? 'bloqueado';

  return (
    <ListItem
      icon={icone}
      // A máscara com hífen da placa antiga é só visual; o banco guarda sem hífen.
      title={placa}
      subtitle={`${veiculo.marca} ${veiculo.modelo} · ${formatarCapacidade(veiculo.capacidade_carga)}`}
      onPress={onEditar}
      accessibilityLabel={`Editar ${placa}`}
    />
  );
}

const styles = StyleSheet.create({
  lista: {
    flex: 1,
  },
  grupo: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  // O Screen só reserva o espaço do FAB quando ele mesmo rola; aqui quem rola é a FlatList.
  espacoDoFab: {
    paddingBottom: FAB_ALTURA_RESERVADA,
  },
});
