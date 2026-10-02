import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList } from 'react-native';

import { Badge, Button, Column, EmptyState, Input, ListItem, Screen, Tabs, Text, colors, type BadgeTone } from '@/ui';

import { formatarPlaca } from './placa';
import { listarVeiculos } from './repository';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo, type Veiculo } from './types';

type Status = 'carregando' | 'pronto' | 'erro';

// Chip colorido por status (critério da US06). O Badge só tem três tons; verde/vermelho seguem
// a mesma lógica semântica do guia (pronto para uso × fora de operação), e o rótulo escrito
// acompanha sempre — cor nunca é o único indicador (DESIGN_CYAN §1).
// TODO(EIX-37): "Inativo" entra aqui quando a migration do enum existir.
const tomStatus: Record<StatusVeiculo, BadgeTone> = {
  Disponivel: 'success',
  EmViagem: 'neutral',
  EmManutencao: 'danger',
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

  // Recarrega ao voltar da criação/edição (a tela não desmonta na pilha) e quando busca/filtro mudam.
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const filtrando = buscaAplicada.trim() !== '' || filtroStatus !== TODOS;

  return (
    <Screen>
      <Column gap="xs">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">Frota</Text>
      </Column>

      <Input
        label="Buscar"
        placeholder="Buscar por placa ou modelo"
        value={busca}
        onChangeText={setBusca}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Tabs options={opcoesFiltro} value={filtroStatus} onChange={setFiltroStatus} accessibilityLabel="Filtrar por status" />

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
        <FlatList
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
                  {/* TODO(EIX-37): botão "Inativar" (soft delete) depende da migration que adiciona
                      "Inativo" ao enum status_veiculo — ainda não existe. */}
                </Column>
              </Column>
            </ListItem>
          )}
        />
      )}
    </Screen>
  );
}
