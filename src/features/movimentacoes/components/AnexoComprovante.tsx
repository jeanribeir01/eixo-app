import React, { useState } from 'react';
import { View, Image, Modal, Alert, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Button, Card, Column, Text, Snackbar } from '@/ui';
import { colors } from '@/ui/tokens';
import { uploadComprovante, removerComprovante } from '@/lib/storage';

type AnexoComprovanteProps = {
  value: string | null;
  onChange: (url: string | null) => void;
  error?: string;
};

export function AnexoComprovante({ value, onChange, error }: AnexoComprovanteProps) {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  function showError(msg: string) {
    setSnackbarMessage(msg);
  }

  async function processarEEnviar(uri: string) {
    try {
      setLoading(true);
      // Comprime imagem para evitar estourar dados (~1MB ou menos)
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [], // Nenhuma transformacao de tamanho a priori, apenas compressao
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );

      const resultado = await uploadComprovante(compressed.uri);
      
      if (resultado.ok) {
        onChange(resultado.url);
      } else {
        showError(resultado.mensagem ?? 'Erro ao fazer upload.');
      }
    } catch (err) {
      console.error(err);
      showError('Não foi possível processar a imagem.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTirarFoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showError('Precisamos de acesso à câmera para tirar a foto do comprovante.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1, // Vamos usar manipular depois para comprimir
    });

    if (!result.canceled && result.assets.length > 0) {
      await processarEEnviar(result.assets[0].uri);
    }
  }

  async function handleEscolherGaleria() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Precisamos de acesso à galeria para escolher o comprovante.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      await processarEEnviar(result.assets[0].uri);
    }
  }

  function escolherOrigem() {
    Alert.alert('Anexar comprovante', 'Escolha a origem da imagem:', [
      { text: 'Câmera', onPress: handleTirarFoto },
      { text: 'Galeria', onPress: handleEscolherGaleria },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleRemover() {
    if (!value) return;
    
    Alert.alert('Remover anexo', 'Tem certeza que deseja apagar o comprovante?', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Remover', 
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const res = await removerComprovante(value);
          setLoading(false);
          
          if (res.ok) {
            onChange(null);
          } else {
            showError(res.mensagem ?? 'Erro ao remover.');
          }
        }
      }
    ]);
  }

  return (
    <Column gap="sm">
      <Text variant="bodySm" tone="body" weight="medium">Comprovante (opcional)</Text>
      
      {value ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => setModalVisible(true)} accessibilityLabel="Ver comprovante em tela cheia">
              <Image source={{ uri: value }} style={styles.thumbnail} />
            </TouchableOpacity>
            
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="bodySm">Anexo salvo</Text>
              <Button label="Remover" variant="ghost" onPress={handleRemover} loading={loading} />
            </View>
          </View>

          <Modal visible={modalVisible} transparent={true} animationType="fade">
            <View style={styles.modalContainer}>
              <TouchableOpacity style={styles.modalCloseArea} onPress={() => setModalVisible(false)} />
              <Image source={{ uri: value }} style={styles.fullImage} resizeMode="contain" />
              <Button label="Fechar" onPress={() => setModalVisible(false)} />
            </View>
          </Modal>
        </Card>
      ) : (
        <Card>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text variant="bodySm" tone="body">Processando imagem...</Text>
            </View>
          ) : (
            <Button label="Anexar comprovante" variant="ghost" onPress={escolherOrigem} />
          )}
        </Card>
      )}
      
      {error && <Text variant="caption" tone="danger">{error}</Text>}
      
      {snackbarMessage && (
        <View style={{ marginTop: 8 }}>
          <Snackbar 
            message={snackbarMessage} 
            tone="error" 
            onDismiss={() => setSnackbarMessage(null)} 
          />
        </View>
      )}
    </Column>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  loadingContainer: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 24,
    justifyContent: 'center',
  },
  modalCloseArea: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
  },
  fullImage: {
    width: '100%',
    height: '70%',
    marginBottom: 24,
  }
});
