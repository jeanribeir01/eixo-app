import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './Button';
import type { IconName } from './icons';
import { ListItem } from './ListItem';
import { Text } from './Text';
import { colors, radius, spacing } from './tokens';

type FolhaProps = {
  visivel: boolean;
  titulo: string;
  mensagem?: string;
  // Voltar do Android, toque no véu e "Cancelar": os três só fecham, sem fazer nada.
  onCancelar: () => void;
  children: ReactNode;
};

// Folha inferior no lugar do Alert nativo (DESIGN-CYAN 2.0): o mesmo visual do seletor (Select), com o
// canto radius.sheet, e os botões do design system em vez dos do sistema. Ninguém usa direto: as telas
// usam a FolhaDeConfirmacao ou a FolhaDeEscolha.
function Folha({ visivel, titulo, mensagem, onCancelar, children }: FolhaProps) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onCancelar}>
      <View style={styles.fundo}>
        {/* O véu inteiro fecha a folha; para o leitor de tela, o "Cancelar" já faz isso. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancelar} accessible={false} />
        {/* A borda de baixo da SafeAreaView afasta os botões da barra de gestos do sistema. */}
        <SafeAreaView
          testID="folha"
          edges={['bottom']}
          style={styles.folha}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
        >
          <View style={styles.texto}>
            <Text variant="subheading" weight="semibold" accessibilityRole="header">
              {titulo}
            </Text>
            {!!mensagem && <Text tone="body">{mensagem}</Text>}
          </View>
          {children}
          <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export type FolhaDeConfirmacaoProps = {
  visivel: boolean;
  // Pergunta sobre a ação ("Excluir movimentação?") e, embaixo, o que acontece depois dela.
  titulo: string;
  mensagem?: string;
  // O botão diz a ação ("Excluir", "Finalizar"), nunca um "Confirmar" genérico.
  rotuloConfirmar: string;
  // danger quando a ação apaga ou descarta algo; primary nas outras.
  tom?: 'primary' | 'danger';
  onConfirmar: () => void;
  onCancelar: () => void;
};

// Pede um "sim" antes de uma ação que não volta atrás. Quem chama decide quando fechar: em geral,
// fecha no onConfirmar e mostra o andamento na própria tela (loading no botão, Snackbar no fim).
export function FolhaDeConfirmacao({
  visivel,
  titulo,
  mensagem,
  rotuloConfirmar,
  tom = 'primary',
  onConfirmar,
  onCancelar,
}: FolhaDeConfirmacaoProps) {
  return (
    <Folha visivel={visivel} titulo={titulo} mensagem={mensagem} onCancelar={onCancelar}>
      <Button label={rotuloConfirmar} variant={tom} onPress={onConfirmar} />
    </Folha>
  );
}

export type OpcaoDaFolha = {
  rotulo: string;
  descricao?: string;
  icone?: IconName;
  onPress: () => void;
};

export type FolhaDeEscolhaProps = {
  visivel: boolean;
  titulo: string;
  mensagem?: string;
  opcoes: OpcaoDaFolha[];
  onCancelar: () => void;
};

// Escolha entre caminhos equivalentes (Câmera ou Galeria, CSV ou PDF): uma linha por opção, nenhuma
// pintada de azul, porque nenhuma é "a principal".
export function FolhaDeEscolha({ visivel, titulo, mensagem, opcoes, onCancelar }: FolhaDeEscolhaProps) {
  return (
    <Folha visivel={visivel} titulo={titulo} mensagem={mensagem} onCancelar={onCancelar}>
      <View>
        {opcoes.map((opcao) => (
          <ListItem
            key={opcao.rotulo}
            icon={opcao.icone}
            title={opcao.rotulo}
            subtitle={opcao.descricao}
            onPress={opcao.onPress}
            // Escolher é a ação: a linha não leva a outra tela, então sem chevron.
            trailing={false}
          />
        ))}
      </View>
    </Folha>
  );
}

const styles = StyleSheet.create({
  // Véu sobre a tela usa a superfície invertida translúcida, sem cor nova (igual ao Select).
  fundo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: `${colors.inverted}80`,
  },
  folha: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  texto: {
    gap: spacing.xs,
  },
});
