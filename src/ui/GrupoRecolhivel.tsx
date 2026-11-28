import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { colors, spacing, touchTarget } from './tokens';

export type GrupoRecolhivelProps = {
  // "Desativadas", "Desativados": a contagem entra depois, no mesmo formato dos outros grupos ("Ativas · 8").
  rotulo: string;
  quantidade: number;
  // Fechado, mostra ao lado os nomes do que está dentro ("Alimento, Lavagem"), numa linha só.
  resumo?: string;
  children: ReactNode;
};

// O fim das listas de cadastro: o que foi desativado continua acessível (para abrir e reativar), mas
// recolhido, sem atrapalhar quem procura um item em uso. É o mesmo grupo em Categorias, Formas de
// pagamento, Rotas e Veículos. O cabeçalho tem o mesmo peso dos outros grupos da lista; a seta diz
// que ele abre.
export function GrupoRecolhivel({ rotulo, quantidade, resumo, children }: GrupoRecolhivelProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={`${rotulo}, ${quantidade}`}
        accessibilityHint={aberto ? 'Recolhe a lista' : 'Mostra a lista'}
        onPress={() => setAberto((atual) => !atual)}
        android_ripple={{ color: colors.border }}
        style={styles.cabecalho}
      >
        {/* Mesmo estilo do TituloSecao (os grupos acima dele na lista); aqui é botão, não cabeçalho. */}
        <Text variant="title" weight="semibold">{`${rotulo} · ${quantidade}`}</Text>
        {/* Ocupa o meio mesmo vazio: a seta fica sempre na borda direita, onde o chevron das linhas fica. */}
        <View style={styles.resumo}>
          {!aberto && !!resumo && (
            <Text variant="bodySm" tone="body" numberOfLines={1}>
              {resumo}
            </Text>
          )}
        </View>
        <Icon name={aberto ? 'recolher' : 'avancar'} size="sm" tone="body" />
      </Pressable>
      {aberto && children}
    </View>
  );
}

const styles = StyleSheet.create({
  // Mesmo respiro dos cabeçalhos de grupo das listas ("Ativas · 8"), com a altura mínima de toque.
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
    marginTop: spacing.base,
  },
  resumo: {
    flex: 1,
  },
});
