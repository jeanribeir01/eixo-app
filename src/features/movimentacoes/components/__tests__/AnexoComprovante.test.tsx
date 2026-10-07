import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadComprovante, removerComprovante } from '@/lib/storage';
import { AnexoComprovante } from '../AnexoComprovante';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

jest.mock('@/lib/storage', () => ({
  uploadComprovante: jest.fn(),
  removerComprovante: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

describe('AnexoComprovante', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar botao para anexar quando não houver valor', () => {
    render(<AnexoComprovante value={null} onChange={mockOnChange} />);
    expect(screen.getByText('Anexar comprovante')).toBeTruthy();
  });

  it('deve renderizar comprovante e botao de remover quando houver valor', () => {
    render(<AnexoComprovante value="https://fake.url/image.jpg" onChange={mockOnChange} />);
    expect(screen.getByText('Anexo salvo')).toBeTruthy();
    expect(screen.getByText('Remover')).toBeTruthy();
  });

  it('deve exibir modal de escolha ao clicar em anexar', () => {
    render(<AnexoComprovante value={null} onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Anexar comprovante'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Anexar comprovante',
      'Escolha a origem da imagem:',
      expect.any(Array)
    );
  });

  it('deve mostrar erro no Snackbar se permissão da câmera for negada', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    
    render(<AnexoComprovante value={null} onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Anexar comprovante'));
    
    // Simula clique no botão "Câmera" do Alert
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await alertButtons[0].onPress();

    await waitFor(() => {
      expect(screen.getByText('Precisamos de acesso à câmera para tirar a foto do comprovante.')).toBeTruthy();
    });
  });

  it('deve fazer upload de foto tirada na câmera com sucesso', async () => {
    (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://camera.jpg' }],
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file://compressed.jpg' });
    (uploadComprovante as jest.Mock).mockResolvedValue({ ok: true, url: 'https://fake.url/success.jpg' });

    render(<AnexoComprovante value={null} onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Anexar comprovante'));
    
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await alertButtons[0].onPress();

    await waitFor(() => {
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        'file://camera.jpg',
        [],
        { compress: 0.5, format: 'jpeg' }
      );
      expect(uploadComprovante).toHaveBeenCalledWith('file://compressed.jpg');
      expect(mockOnChange).toHaveBeenCalledWith('https://fake.url/success.jpg');
    });
  });

  it('deve fazer upload de imagem escolhida da galeria com sucesso', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://gallery.jpg' }],
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file://compressed_gallery.jpg' });
    (uploadComprovante as jest.Mock).mockResolvedValue({ ok: true, url: 'https://fake.url/gallery_success.jpg' });

    render(<AnexoComprovante value={null} onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Anexar comprovante'));
    
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await alertButtons[1].onPress();

    await waitFor(() => {
      expect(uploadComprovante).toHaveBeenCalledWith('file://compressed_gallery.jpg');
      expect(mockOnChange).toHaveBeenCalledWith('https://fake.url/gallery_success.jpg');
    });
  });

  it('deve mostrar erro no Snackbar se upload falhar', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://gallery.jpg' }],
    });
    (ImageManipulator.manipulateAsync as jest.Mock).mockResolvedValue({ uri: 'file://compressed_gallery.jpg' });
    (uploadComprovante as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Falha no servidor.' });

    render(<AnexoComprovante value={null} onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Anexar comprovante'));
    
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await alertButtons[1].onPress();

    await waitFor(() => {
      expect(screen.getByText('Falha no servidor.')).toBeTruthy();
    });
  });

  it('deve remover comprovante com sucesso', async () => {
    (removerComprovante as jest.Mock).mockResolvedValue({ ok: true });

    render(<AnexoComprovante value="https://fake.url/image.jpg" onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Remover'));
    
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await alertButtons[1].onPress();

    await waitFor(() => {
      expect(removerComprovante).toHaveBeenCalledWith('https://fake.url/image.jpg');
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });
  });

  it('deve mostrar erro no Snackbar se remoção falhar', async () => {
    (removerComprovante as jest.Mock).mockResolvedValue({ ok: false, mensagem: 'Erro ao remover arquivo.' });

    render(<AnexoComprovante value="https://fake.url/image.jpg" onChange={mockOnChange} />);
    fireEvent.press(screen.getByText('Remover'));
    
    const alertButtons = (Alert.alert as jest.Mock).mock.calls[0][2];
    await alertButtons[1].onPress();

    await waitFor(() => {
      expect(screen.getByText('Erro ao remover arquivo.')).toBeTruthy();
    });
  });
});
