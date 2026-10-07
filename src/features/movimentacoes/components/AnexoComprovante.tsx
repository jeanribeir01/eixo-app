import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { uploadComprovante, urlDoComprovante } from '@/lib/storage';
import { Button, Card, Column, Text, colors, radius, spacing, touchTarget } from '@/ui';

// Foto de celular tem 3000–4000 px de largura e passa de 3 MB. Com 1600 px e JPEG 0,6 o arquivo
// fica bem abaixo de 1 MB e o texto do comprovante continua legível (AC: "máx. ~1MB").
const LARGURA_MAXIMA = 1600;
const QUALIDADE_JPEG = 0.6;

type AnexoComprovanteProps = {
  label: string;
  // Caminho do arquivo no bucket, ou null sem anexo.
  value: string | null;
  onChange: (caminho: string | null) => void;
  // Mensagens de erro vão para o Snackbar do formulário, que fica fora da rolagem (overlay do Screen).
  onErro: (mensagem: string) => void;
  error?: string;
};

async function comprimir(imagem: ImagePicker.ImagePickerAsset): Promise<string> {
  const contexto = ImageManipulator.manipulate(imagem.uri);
  // Só reduz: imagem pequena ampliada ficaria maior e pior.
  if (imagem.width > LARGURA_MAXIMA) contexto.resize({ width: LARGURA_MAXIMA });
  const renderizada = await contexto.renderAsync();
  const salva = await renderizada.saveAsync({ compress: QUALIDADE_JPEG, format: SaveFormat.JPEG });
  return salva.uri;
}

export function AnexoComprovante({ label, value, onChange, onErro, error }: AnexoComprovanteProps) {
  const [enviando, setEnviando] = useState(false);
  const [assinada, setAssinada] = useState<{ caminho: string; url: string } | null>(null);
  const [telaCheia, setTelaCheia] = useState(false);

  // A URL só vale para o caminho que a gerou: trocou o anexo, a miniatura espera a URL nova.
  const url = value && assinada?.caminho === value ? assinada.url : null;

  // O bucket é privado: para mostrar a imagem é preciso pedir uma signed URL a cada caminho novo.
  useEffect(() => {
    if (!value) return;

    let cancelado = false;
    urlDoComprovante(value).then((resultado) => {
      if (cancelado) return;
      if (resultado.ok) setAssinada({ caminho: value, url: resultado.data });
      else onErro(resultado.mensagem);
    });
    return () => {
      cancelado = true;
    };
    // onErro fica fora: a tela recria a função a cada render e a URL seria pedida de novo à toa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  async function enviar(resultado: ImagePicker.ImagePickerResult) {
    if (resultado.canceled || resultado.assets.length === 0) return;

    setEnviando(true);
    try {
      const uri = await comprimir(resultado.assets[0]);
      const upload = await uploadComprovante(uri);
      if (upload.ok) onChange(upload.data);
      else onErro(upload.mensagem);
    } catch {
      onErro('Não foi possível preparar a imagem. Tente outra foto.');
    } finally {
      setEnviando(false);
    }
  }

  // Permissão pedida só na hora do uso (AC), com mensagem que explica o porquê se for negada.
  async function tirarFoto() {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      onErro('Sem acesso à câmera. Libere a permissão nos ajustes do aparelho para fotografar o comprovante.');
      return;
    }
    await enviar(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 }));
  }

  async function escolherDaGaleria() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      onErro('Sem acesso à galeria. Libere a permissão nos ajustes do aparelho para escolher o comprovante.');
      return;
    }
    await enviar(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 }));
  }

  function escolherOrigem() {
    Alert.alert('Anexar comprovante', 'De onde vem a imagem?', [
      { text: 'Câmera', onPress: tirarFoto },
      { text: 'Galeria', onPress: escolherDaGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  // Remover só limpa o campo. O arquivo é apagado pela tela: na hora, se ainda não foi salvo em
  // nenhuma movimentação, ou depois de salvar, se era o anexo que já estava gravado.
  function confirmarRemocao() {
    Alert.alert('Remover comprovante', 'O arquivo será apagado ao salvar a movimentação.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => onChange(null) },
    ]);
  }

  return (
    <Column gap="xs">
      <Text variant="bodySm" tone="body" weight="medium">
        {label}
      </Text>

      <Card>
        {enviando ? (
          <Column direction="row" align="center" gap="sm">
            <ActivityIndicator size="small" color={colors.accent} />
            <Text variant="bodySm" tone="body">
              Enviando comprovante…
            </Text>
          </Column>
        ) : value ? (
          <Column direction="row" align="center" gap="md">
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="Ver comprovante em tela cheia"
              disabled={!url}
              onPress={() => setTelaCheia(true)}
              style={styles.miniatura}
            >
              {url ? (
                <Image source={{ uri: url }} style={styles.miniatura} accessibilityIgnoresInvertColors />
              ) : (
                <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando comprovante" />
              )}
            </Pressable>
            <View style={styles.flex}>
              <Text variant="bodySm">Comprovante anexado</Text>
            </View>
            <Button label="Remover" variant="ghost" onPress={confirmarRemocao} />
          </Column>
        ) : (
          <Button label="Anexar comprovante" variant="ghost" onPress={escolherOrigem} />
        )}
      </Card>

      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}

      <Modal visible={telaCheia && !!url} animationType="fade" onRequestClose={() => setTelaCheia(false)}>
        <SafeAreaView style={styles.telaCheia}>
          {url && (
            <Image
              source={{ uri: url }}
              style={styles.flex}
              resizeMode="contain"
              accessibilityLabel="Comprovante"
              accessibilityIgnoresInvertColors
            />
          )}
          {/* Única ação da tela cheia, por isso o primário: o ghost tem texto escuro e sumiria no fundo. */}
          <Button label="Fechar" onPress={() => setTelaCheia(false)} />
        </SafeAreaView>
      </Modal>
    </Column>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // A miniatura também é o alvo de toque para abrir a tela cheia: 44pt, como qualquer botão.
  miniatura: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.icon,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Foto em tela cheia sobre fundo escuro: a superfície invertida do guia, não um preto novo.
  telaCheia: {
    flex: 1,
    backgroundColor: colors.inverted,
    padding: spacing.base,
    gap: spacing.base,
  },
});
