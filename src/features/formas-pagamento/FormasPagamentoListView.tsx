import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList } from 'react-native';

import { Button, Column, EmptyState, Input, ListItem, Screen, Snackbar, Switch, Text, colors } from '@/ui';

import { definirAtivaFormaPagamento, listarFormasPagamento } from './formasPagamentoRepository';
import type { FormaPagamento } from './types';

type Status = 'carregando' | 'pronto' | 'erro';

type Feedback = { mensagem: string; tone: 'success' | 'error' };

const METODOS_FIXOS = ['Boleto', 'Pix', 'TED', 'Cartão Corporativo'];

export function FormasPagamentoListView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [mostrarDesativadas, setMostrarDesativadas] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const carregar = useCallback(async () => {
    setStatus('carregando');
    const resultado = await listarFormasPagamento();
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setStatus('erro');
      return;
    }
    setFormasPagamento(resultado.data);
    setStatus('pronto');
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function handleAlternarAtiva(forma: FormaPagamento) {
    setProcessandoId(forma.id);
    const resultado = await definirAtivaFormaPagamento(forma.id, !forma.ativa);
    setProcessandoId(null);

    if (!resultado.ok) {
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    setFormasPagamento((atual) => atual.map((item) => (item.id === forma.id ? resultado.data : item)));
    setFeedback({
      mensagem: resultado.data.ativa ? 'Forma de pagamento reativada.' : 'Forma de pagamento desativada.',
      tone: 'success',
    });
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = formasPagamento.filter((forma) => {
    if (!mostrarDesativadas && !forma.ativa) return false;
    if (!termo) return true;
    return forma.nome.toLowerCase().includes(termo);
  });

  return (
    <Screen>
      <Column gap="xs">
        <Text variant="bodySm" weight="medium">
          Eixo Certo
        </Text>
        <Text variant="heading">Formas de Pagamento</Text>
      </Column>

      <Input label="Buscar" placeholder="Buscar por nome" value={busca} onChangeText={setBusca} />

      <Switch label="Mostrar desativadas" value={mostrarDesativadas} onValueChange={setMostrarDesativadas} />

      <Button label="Nova forma de pagamento" onPress={() => router.push('/formas-pagamento/nova')} />

      {status === 'carregando' && (
        <Column align="center">
          <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando formas de pagamento" />
        </Column>
      )}

      {status === 'erro' && (
        <EmptyState title="Não foi possível carregar" description={erro ?? undefined} actionLabel="Tentar novamente" onAction={carregar} />
      )}

      {status === 'pronto' && filtradas.length === 0 && (
        <EmptyState
          title={termo ? 'Nenhuma forma de pagamento encontrada' : 'Nenhuma forma de pagamento cadastrada'}
          description={termo ? 'Tente buscar por outro nome.' : 'Crie a primeira forma de pagamento para começar.'}
          actionLabel={termo ? undefined : 'Nova forma de pagamento'}
          onAction={termo ? undefined : () => router.push('/formas-pagamento/nova')}
        />
      )}

      {status === 'pronto' && filtradas.length > 0 && (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          renderItem={({ item }) => {
            const isFixo = METODOS_FIXOS.includes(item.nome);
            return (
              <ListItem>
                <Column gap="sm">
                  <Column gap="xs" align="start">
                    <Text weight="medium" tone={item.ativa ? 'primary' : 'muted'}>
                      {item.nome}
                    </Text>
                  </Column>
                  <Column direction="row" gap="sm" wrap>
                    {!isFixo && <Button label="Editar" variant="ghost" onPress={() => router.push(`/formas-pagamento/${item.id}/editar`)} />}
                    {!isFixo && (
                      <Button
                        label={item.ativa ? 'Desativar' : 'Reativar'}
                        variant="ghost"
                        loading={processandoId === item.id}
                        onPress={() => handleAlternarAtiva(item)}
                      />
                    )}
                  </Column>
                </Column>
              </ListItem>
            );
          }}
        />
      )}

      {feedback && (
        <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />
      )}
    </Screen>
  );
}
