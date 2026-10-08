import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { SaldoAtualCard } from '@/features/caixa/components/SaldoAtualCard';
import { buscarResumoCaixa } from '@/features/caixa/fonteResumoCaixa';
import { Button, Card, FAB, ListItem, ListSection, Screen, Skeleton, Text, type IconName } from '@/ui';

type Saldo = { status: 'carregando' } | { status: 'pronto'; centavos: number } | { status: 'erro' };

type Atalho = { titulo: string; descricao: string; icone: IconName; href: Href };

// O dia a dia do caixa primeiro; os cadastros, que mudam pouco, embaixo.
const CAIXA: Atalho[] = [
  { titulo: 'Movimentações', descricao: 'Entradas e saídas do mês', icone: 'movimentacoes', href: '/movimentacoes' },
  { titulo: 'Saldo e projeção', descricao: 'Saldo atual e previsão dos próximos meses', icone: 'saldo', href: '/caixa' },
  { titulo: 'Dívidas', descricao: 'Financiamentos e parcelas', icone: 'dividas', href: '/dividas' },
];

const CADASTROS: Atalho[] = [
  { titulo: 'Categorias', descricao: 'Tipos de entrada e de saída', icone: 'categorias', href: '/categorias' },
  { titulo: 'Formas de pagamento', descricao: 'Pix, boleto, cartão e TED', icone: 'formasPagamento', href: '/formas-pagamento' },
];

// Aba inicial de Admin e Financeiro (EIX-62): o saldo em destaque e o menu do módulo. O menu nunca
// depende do saldo: se o saldo falhar, o erro fica dentro do cartão e as linhas continuam tocáveis.
export function FinanceiroHubView() {
  const router = useRouter();
  const [saldo, setSaldo] = useState<Saldo>({ status: 'carregando' });
  // Só a resposta mais recente escreve na tela (mesmo padrão das listas).
  const ultimoPedido = useRef(0);

  const carregarSaldo = useCallback(async () => {
    const pedido = ++ultimoPedido.current;
    const resultado = await buscarResumoCaixa();
    if (pedido !== ultimoPedido.current) return;

    // Ao voltar para a aba o saldo novo substitui o antigo; se essa recarga falhar, o antigo fica.
    setSaldo((atual) => {
      if (resultado.ok) return { status: 'pronto', centavos: resultado.data.saldoAtualCentavos };
      return atual.status === 'pronto' ? atual : { status: 'erro' };
    });
  }, []);

  // Recarrega sempre que a aba volta ao foco: quem acabou de lançar uma movimentação vê o saldo novo.
  useFocusEffect(
    useCallback(() => {
      carregarSaldo();
    }, [carregarSaldo]),
  );

  function tentarDeNovo() {
    setSaldo({ status: 'carregando' });
    carregarSaldo();
  }

  function linha(atalho: Atalho) {
    return (
      <ListItem
        key={atalho.titulo}
        title={atalho.titulo}
        subtitle={atalho.descricao}
        icon={atalho.icone}
        onPress={() => router.push(atalho.href)}
      />
    );
  }

  return (
    <Screen scroll fab={<FAB label="Nova movimentação" onPress={() => router.push('/movimentacoes/nova')} />}>
      {/* Aba não tem header nativo: o título fica no conteúdo. */}
      <Text variant="heading">Financeiro</Text>

      {saldo.status === 'carregando' && <Skeleton height="xxl" accessibilityLabel="Carregando saldo" />}
      {saldo.status === 'pronto' && (
        <SaldoAtualCard saldoAtualCentavos={saldo.centavos} onPress={() => router.push('/caixa')} />
      )}
      {saldo.status === 'erro' && (
        <Card variant="feature">
          <Text tone="body">Não foi possível carregar o saldo.</Text>
          <Button label="Tentar novamente" variant="ghost" onPress={tentarDeNovo} />
        </Card>
      )}

      <ListSection label="Caixa">{CAIXA.map(linha)}</ListSection>
      <ListSection label="Cadastros">{CADASTROS.map(linha)}</ListSection>
    </Screen>
  );
}
