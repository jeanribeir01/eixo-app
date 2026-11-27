import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  ChipFiltro,
  Column,
  EmptyState,
  Input,
  LinhaDeFiltros,
  List,
  ListItem,
  Screen,
  ScreenColumn,
  Skeleton,
  Snackbar,
  Text,
  spacing,
  useScreenColumn,
  type IconName,
} from '@/ui';

import { formatarPlaca } from './placa';
import { inativarVeiculo, listarVeiculos, reativarVeiculo, type Resultado } from './repository';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo, type Veiculo } from './types';

type Status = 'carregando' | 'pronto' | 'erro';
type Feedback = { mensagem: string; tone: 'success' | 'error' };

// Grupos na ordem em que o gestor olha a frota: o que está rodando, o que pode sair, o que está parado. O
// status vem do cabeçalho do grupo (critério da US06: o status aparece em cada veículo, agora pelo grupo).
const GRUPOS: { status: StatusVeiculo; rotulo: string; icone: IconName }[] = [
  { status: 'EmViagem', rotulo: 'Em viagem', icone: 'viagens' },
  { status: 'Disponivel', rotulo: 'Disponíveis', icone: 'frota' },
  { status: 'EmManutencao', rotulo: 'Em manutenção', icone: 'manutencoes' },
  { status: 'Inativo', rotulo: 'Inativos', icone: 'bloqueado' },
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

const opcoesFiltro = [
  { label: TODOS, value: TODOS },
  ...STATUS_VEICULO.map((status) => ({ label: rotuloStatusVeiculo[status], value: status })),
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
  const [alterandoId, setAlterandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const operacaoPendente = useRef(false);
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

  // A confirmação pode permanecer aberta enquanto a busca/filtro muda.
  const carregarAtual = useRef(carregar);
  useEffect(() => {
    carregarAtual.current = carregar;
  }, [carregar]);

  // Inativar e reativar compartilham a trava: um veículo só tem uma das duas ações na linha, e
  // uma operação por vez evita duas escritas cruzadas na mesma lista. A operação e a mensagem
  // chegam prontas, então uma ação nova de status não precisa mexer aqui.
  async function alterarStatus(
    veiculo: Veiculo,
    operacao: (id: string) => Promise<Resultado<Veiculo>>,
    mensagemSucesso: (atualizado: Veiculo) => string,
  ) {
    if (operacaoPendente.current) return;
    operacaoPendente.current = true;
    setAlterandoId(veiculo.id);
    try {
      const resultado = await operacao(veiculo.id);
      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }
      setFeedback({ mensagem: mensagemSucesso(resultado.data), tone: 'success' });
      await carregarAtual.current();
    } catch {
      // O repositório devolve as falhas conhecidas como resultado; aqui só chega o imprevisto
      // (ex.: fetch lançando). Sem este catch o erro sumiria no onPress do Alert, sem Snackbar.
      setFeedback({ mensagem: 'Não foi possível concluir a operação. Atualize a lista e tente novamente.', tone: 'error' });
    } finally {
      operacaoPendente.current = false;
      setAlterandoId(null);
    }
  }

  function confirmarInativacao(veiculo: Veiculo) {
    if (operacaoPendente.current) return;
    Alert.alert('Inativar veículo?', `${formatarPlaca(veiculo.placa)} deixará de aparecer nas seleções de viagens e manutenções. O histórico será preservado.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Inativar', style: 'destructive', onPress: () => alterarStatus(veiculo, inativarVeiculo, () => 'Veículo inativado.') },
    ]);
  }

  // Reativar não é destrutivo (o veículo só volta às seleções), por isso o botão não usa o estilo vermelho.
  // Com viagem ou manutenção aberta o banco devolve o veículo com esse status (trigger da EIX-81),
  // e a mensagem diz isso para o gestor não esperar vê-lo como Disponível.
  function confirmarReativacao(veiculo: Veiculo) {
    if (operacaoPendente.current) return;
    Alert.alert('Reativar veículo?', `${formatarPlaca(veiculo.placa)} volta à frota. Se houver viagem ou manutenção em aberto, ele volta com esse status.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reativar',
        onPress: () =>
          alterarStatus(veiculo, reativarVeiculo, (atualizado) =>
            atualizado.status === 'Disponivel' ? 'Veículo reativado.' : `Veículo reativado como ${rotuloStatusVeiculo[atualizado.status]}.`,
          ),
      },
    ]);
  }

  // Recarrega ao voltar da criação/edição (a tela não desmonta na pilha) e quando busca/filtro mudam.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const filtrando = buscaAplicada.trim() !== '' || filtroStatus !== TODOS;
  const linhas = useMemo(() => agruparPorStatus(veiculos), [veiculos]);

  return (
    // Tela interna, aberta pelo hub de Frota (EIX-77): o título "Veículos" vem do header nativo.
    <Screen
      underHeader
      list
      overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />}
    >
      {/* Fora da lista, na coluna: no tablet fica alinhado com as linhas (EIX-94). */}
      <ScreenColumn>
        <Input
          label="Buscar veículo"
          icone="buscar"
          placeholder="Placa ou modelo"
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Chip no lugar da fileira de abas: cinco status não cabem lado a lado em 360 (referência
            Nubank do redesign). */}
        <LinhaDeFiltros accessibilityLabel="Filtros">
          <ChipFiltro label="Status" value={filtroStatus} valorPadrao={TODOS} options={opcoesFiltro} onChange={setFiltroStatus} />
        </LinhaDeFiltros>

        {/* Único elemento cyan preenchido da tela: a ação primária (DESIGN_CYAN §1). */}
        <Button label="Novo veículo" onPress={() => router.push('/frota/novo')} />

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
          contentContainerStyle={coluna}
          renderItem={({ item }) =>
            item.tipo === 'grupo' ? (
              <View style={styles.grupo}>
                <Text weight="semibold" accessibilityRole="header">
                  {item.rotulo}
                </Text>
              </View>
            ) : (
              <LinhaDoVeiculo
                veiculo={item.veiculo}
                alterando={alterandoId === item.veiculo.id}
                bloqueado={alterandoId !== null}
                onEditar={() => router.push(`/frota/${item.veiculo.id}/editar`)}
                onInativar={() => confirmarInativacao(item.veiculo)}
                onReativar={() => confirmarReativacao(item.veiculo)}
              />
            )
          }
        />
      )}
    </Screen>
  );
}

type LinhaDoVeiculoProps = {
  veiculo: Veiculo;
  alterando: boolean;
  bloqueado: boolean;
  onEditar: () => void;
  onInativar: () => void;
  onReativar: () => void;
};

// Uma linha por veículo, no lugar dos botões "Editar"/"Inativar" grandes em cada um: tocar na linha edita, e
// a ação de status fica no "Mais opções" à direita, com confirmação no Alert do sistema (como em
// Movimentações). O nome acessível do botão diz a ação e a placa: "Inativar ABC-1234".
function LinhaDoVeiculo({ veiculo, alterando, bloqueado, onEditar, onInativar, onReativar }: LinhaDoVeiculoProps) {
  const placa = formatarPlaca(veiculo.placa);
  const icone = GRUPOS.find((grupo) => grupo.status === veiculo.status)?.icone ?? 'frota';
  // Só Disponível inativa (em viagem ou manutenção não, INA-08) e só Inativo reativa (REA-04).
  const acao =
    veiculo.status === 'Disponivel'
      ? { label: `Inativar ${placa}`, onPress: onInativar }
      : veiculo.status === 'Inativo'
        ? { label: `Reativar ${placa}`, onPress: onReativar }
        : null;

  return (
    <ListItem
      icon={icone}
      // A máscara com hífen da placa antiga é só visual; o banco guarda sem hífen.
      title={placa}
      subtitle={`${veiculo.marca} ${veiculo.modelo} · ${formatarCapacidade(veiculo.capacidade_carga)}`}
      onPress={onEditar}
      accessibilityLabel={`Editar ${placa}`}
      control={
        acao ? (
          <Button
            variant="icon"
            icon="maisOpcoes"
            label={acao.label}
            onPress={acao.onPress}
            loading={alterando}
            disabled={bloqueado}
          />
        ) : undefined
      }
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
});
