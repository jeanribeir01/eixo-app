import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';

import { formatarMoeda } from '@/lib/money';
import { isoParaDataBR } from '@/lib/datas';
import { Button, Column, Screen, Text, colors, spacing } from '@/ui';

import { buscarDivida } from '../dividasRepository';
import type { DividaDetalhe } from '../types';

type Status = 'carregando' | 'pronto' | 'erro';

export function DividaDetalheView({ id }: { id: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('carregando');
  const [divida, setDivida] = useState<DividaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const resultado = await buscarDivida(id);
      if (cancelado) return;

      if (!resultado.ok) {
        setErro(resultado.mensagem);
        setStatus('erro');
        return;
      }
      setDivida(resultado.data);
      setStatus('pronto');
    }

    carregar();
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (status === 'carregando') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (status === 'erro' || !divida) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl }}>
          <Column align="center" gap="lg">
            <Text variant="subheading" tone="primary" style={{ textAlign: 'center' }}>Não foi possível carregar</Text>
            <Text variant="body" tone="body" style={{ textAlign: 'center' }}>{erro}</Text>
            <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
          </Column>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={divida.parcelas}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ padding: spacing.base, paddingBottom: spacing.lg }}>
            <Column gap="md">
              <Column gap="xs">
                <Text variant="bodySm" weight="medium" tone="muted">{divida.categoria.titulo}</Text>
                <Text variant="heading" tone="primary">{divida.descricao}</Text>
              </Column>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: spacing.sm, padding: spacing.lg }}>
                <Column gap="md">
                  <Column gap="xs">
                    <Text variant="caption" tone="body">Soma Total</Text>
                    <Text variant="body" weight="medium" tone="primary">{formatarMoeda(divida.somaTotalCentavos)}</Text>
                  </Column>
                  <Column direction="row" gap="lg">
                    <Column gap="xs">
                      <Text variant="caption" tone="body">Parcelas Pagas</Text>
                      <Text variant="body" weight="medium" tone="primary">{divida.parcelasPagas} de {divida.quantidadeParcelas}</Text>
                    </Column>
                    <Column gap="xs">
                      <Text variant="caption" tone="body">Valor Parcela</Text>
                      <Text variant="body" weight="medium" tone="primary">{formatarMoeda(divida.valorParcelaCentavos)}</Text>
                    </Column>
                  </Column>
                </Column>
              </View>
              <Text variant="subheading" tone="primary" style={{ marginTop: spacing.md }}>Parcelas Geradas</Text>
            </Column>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.base, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Column gap="xs">
                <Text variant="body" weight="medium" tone="primary">Parcela {item.numero}</Text>
                <Text variant="bodySm" tone="body">Venc: {isoParaDataBR(item.dataVencimento)}</Text>
              </Column>
              <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                <Text variant="body" weight="medium" tone="primary">{formatarMoeda(item.valorCentavos)}</Text>
                <Text variant="caption" tone={item.status === 'Pago' ? 'success' : 'muted'} weight="medium">{item.status}</Text>
              </View>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}
