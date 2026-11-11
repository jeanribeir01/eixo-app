import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';

import { List, Badge, Button, Column, EmptyState, Input, ListItem, Screen, Snackbar, Tabs, Text, colors, type BadgeTone } from '@/ui';

import { formatarPlaca } from './placa';
import { inativarVeiculo, listarVeiculos, reativarVeiculo } from './repository';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo, type Veiculo } from './types';

type Status = 'carregando' | 'pronto' | 'erro';
type Feedback = { mensagem: string; tone: 'success' | 'error' };

// Chip por status (critério da US06). Vermelho/verde são reservados para entrada/saída
// financeira (DESIGN_CYAN §1, CLAUDE.md §8), então "Em Manutenção" fica neutro; o rótulo
// escrito acompanha sempre — cor nunca é o único indicador.
const tomStatus: Record<StatusVeiculo, BadgeTone> = {
  Disponivel: 'success',
  EmViagem: 'neutral',
  EmManutencao: 'neutral',
  Inativo: 'neutral',
};

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
  // uma operação por vez evita duas escritas cruzadas na mesma lista.
  async function alterarStatus(veiculo: Veiculo, acao: 'inativar' | 'reativar') {
    if (operacaoPendente.current) return;
    operacaoPendente.current = true;
    setAlterandoId(veiculo.id);
    try {
      const resultado = acao === 'inativar' ? await inativarVeiculo(veiculo.id) : await reativarVeiculo(veiculo.id);
      if (!resultado.ok) {
        setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
        return;
      }
      setFeedback({ mensagem: acao === 'inativar' ? 'Veículo inativado.' : 'Veículo reativado.', tone: 'success' });
      await carregarAtual.current();
    } finally {
      operacaoPendente.current = false;
      setAlterandoId(null);
    }
  }

  function confirmarInativacao(veiculo: Veiculo) {
    if (operacaoPendente.current) return;
    Alert.alert('Inativar veículo?', `${formatarPlaca(veiculo.placa)} deixará de aparecer nas seleções de viagens e manutenções. O histórico será preservado.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Inativar', style: 'destructive', onPress: () => alterarStatus(veiculo, 'inativar') },
    ]);
  }

  // Reativar não é destrutivo (o veículo só volta às seleções), por isso o botão não usa o estilo vermelho.
  function confirmarReativacao(veiculo: Veiculo) {
    if (operacaoPendente.current) return;
    Alert.alert('Reativar veículo?', `${formatarPlaca(veiculo.placa)} volta como Disponível e passa a aparecer nas seleções de viagens e manutenções.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reativar', onPress: () => alterarStatus(veiculo, 'reativar') },
    ]);
  }

  // Recarrega ao voltar da criação/edição (a tela não desmonta na pilha) e quando busca/filtro mudam.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const filtrando = buscaAplicada.trim() !== '' || filtroStatus !== TODOS;

  return (
    // Tela interna, aberta pelo hub de Frota (EIX-77): o título "Veículos" vem do header nativo.
    <Screen underHeader overlay={feedback && <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />}>
      <Input
        label="Buscar"
        placeholder="Buscar por placa ou modelo"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <ScrollView horizontal style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
        <Tabs options={opcoesFiltro} value={filtroStatus} onChange={setFiltroStatus} accessibilityLabel="Filtrar por status" />
      </ScrollView>

      {/* Único elemento cyan preenchido da tela: a ação primária (DESIGN_CYAN §1). */}
      <Button label="Novo veículo" onPress={() => router.push('/frota/novo')} />

      {status === 'carregando' && (
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando veículos" />
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

      {status === 'pronto' && veiculos.length > 0 && (
        <List
          data={veiculos}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <ListItem>
              <Column gap="sm">
                <Column gap="xs" align="start">
                  {/* A máscara com hífen da placa antiga é só visual; o banco guarda sem hífen. */}
                  <Text weight="medium">{formatarPlaca(item.placa)}</Text>
                  <Text variant="bodySm" tone="body">
                    {`${item.marca} ${item.modelo} · ${formatarCapacidade(item.capacidade_carga)}`}
                  </Text>
                  <Badge label={rotuloStatusVeiculo[item.status]} tone={tomStatus[item.status]} />
                </Column>
                <Column direction="row" gap="sm" wrap>
                  <Button
                    label="Editar"
                    variant="ghost"
                    onPress={() => router.push(`/frota/${item.id}/editar`)}
                  />
                  {item.status === 'Disponivel' && (
                    <Button label="Inativar" variant="ghost" onPress={() => confirmarInativacao(item)} loading={alterandoId === item.id} disabled={alterandoId !== null} />
                  )}
                  {item.status === 'Inativo' && (
                    <Button label="Reativar" variant="ghost" onPress={() => confirmarReativacao(item)} loading={alterandoId === item.id} disabled={alterandoId !== null} />
                  )}
                </Column>
              </Column>
            </ListItem>
          )}
        />
      )}
    </Screen>
  );
}
