import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { uploadComprovante, urlDoComprovante } from '@/lib/storage';

import { AnexoComprovante } from '../AnexoComprovante';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('@/lib/storage', () => ({
  uploadComprovante: jest.fn(),
  urlDoComprovante: jest.fn(),
}));

const mockPermissaoCamera = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const mockCamera = ImagePicker.launchCameraAsync as jest.Mock;
const mockPermissaoGaleria = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockGaleria = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockManipular = ImageManipulator.manipulate as jest.Mock;
const mockUpload = uploadComprovante as jest.MockedFunction<typeof uploadComprovante>;
const mockUrl = urlDoComprovante as jest.MockedFunction<typeof urlDoComprovante>;
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

const onChange = jest.fn();
const onErro = jest.fn();

// Contexto do ImageManipulator: resize encadeável, render e save devolvendo o arquivo comprimido.
const contexto = { resize: jest.fn(), renderAsync: jest.fn() };
const salvarImagem = jest.fn();

function foto(largura: number) {
  return { canceled: false, assets: [{ uri: 'file://original.jpg', width: largura, height: largura }] };
}

function renderAnexo(value: string | null = null) {
  render(<AnexoComprovante label="Comprovante (opcional)" value={value} onChange={onChange} onErro={onErro} />);
}

// A miniatura só fica tocável depois que a signed URL chega.
async function esperarMiniatura() {
  const miniatura = screen.getByRole('imagebutton', { name: 'Ver comprovante em tela cheia' });
  await waitFor(() => expect(miniatura).toBeEnabled());
  return miniatura;
}

// Toca numa opção do último Alert aberto (o Alert nativo não aparece na árvore do teste).
async function escolherNoAlerta(opcao: string) {
  const botoes = mockAlert.mock.calls.at(-1)?.[2] ?? [];
  await act(async () => botoes.find((botao) => botao.text === opcao)?.onPress?.());
}

beforeEach(() => {
  jest.clearAllMocks();
  contexto.renderAsync.mockResolvedValue({ saveAsync: salvarImagem });
  salvarImagem.mockResolvedValue({ uri: 'file://comprimida.jpg' });
  mockManipular.mockReturnValue(contexto);
  mockPermissaoCamera.mockResolvedValue({ granted: true });
  mockPermissaoGaleria.mockResolvedValue({ granted: true });
  mockUpload.mockResolvedValue({ ok: true, data: 'novo.jpg' });
  mockUrl.mockResolvedValue({ ok: true, data: 'https://assinada.example/antigo.jpg' });
});

describe('AnexoComprovante — anexar (EIX-34)', () => {
  it('sem anexo mostra o rótulo e o botão "Anexar comprovante"', () => {
    renderAnexo();

    expect(screen.getByText('Comprovante (opcional)')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Anexar comprovante' })).toBeOnTheScreen();
  });

  it('oferece tirar foto na hora ou escolher da galeria (AC 1)', () => {
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));

    const opcoes = mockAlert.mock.calls[0][2]?.map((botao) => botao.text);
    expect(opcoes).toEqual(['Câmera', 'Galeria', 'Cancelar']);
  });

  it('câmera: comprime para 1600 px em JPEG 0,6, envia e devolve o caminho (AC 3, 4)', async () => {
    mockCamera.mockResolvedValue(foto(4000));
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Câmera');

    expect(mockPermissaoCamera).toHaveBeenCalled();
    expect(mockManipular).toHaveBeenCalledWith('file://original.jpg');
    expect(contexto.resize).toHaveBeenCalledWith({ width: 1600 });
    expect(salvarImagem).toHaveBeenCalledWith({ compress: 0.6, format: 'jpeg' });
    expect(mockUpload).toHaveBeenCalledWith('file://comprimida.jpg');
    expect(onChange).toHaveBeenCalledWith('novo.jpg');
  });

  it('imagem menor que 1600 px não é ampliada, só comprimida', async () => {
    mockGaleria.mockResolvedValue(foto(1200));
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Galeria');

    expect(contexto.resize).not.toHaveBeenCalled();
    expect(salvarImagem).toHaveBeenCalledWith({ compress: 0.6, format: 'jpeg' });
    expect(onChange).toHaveBeenCalledWith('novo.jpg');
  });

  it('cancelar na câmera não envia nada', async () => {
    mockCamera.mockResolvedValue({ canceled: true, assets: null });
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Câmera');

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('enquanto envia mostra "Enviando comprovante…" no lugar do botão (AC 7)', async () => {
    let concluir: (resultado: Awaited<ReturnType<typeof uploadComprovante>>) => void = () => undefined;
    mockUpload.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    mockCamera.mockResolvedValue(foto(4000));
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    // Sem esperar o envio terminar: o upload fica pendente até `concluir`.
    const camera = mockAlert.mock.calls[0][2]?.find((botao) => botao.text === 'Câmera');
    await act(async () => {
      camera?.onPress?.();
    });

    expect(await screen.findByText('Enviando comprovante…')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Anexar comprovante' })).not.toBeOnTheScreen();

    await act(async () => concluir({ ok: true, data: 'novo.jpg' }));
    expect(onChange).toHaveBeenCalledWith('novo.jpg');
  });
});

describe('AnexoComprovante — erros (EIX-34)', () => {
  it('câmera negada: não abre a câmera e explica como liberar (AC 2)', async () => {
    mockPermissaoCamera.mockResolvedValue({ granted: false });
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Câmera');

    expect(mockCamera).not.toHaveBeenCalled();
    expect(onErro).toHaveBeenCalledWith(
      'Sem acesso à câmera. Libere a permissão nos ajustes do aparelho para fotografar o comprovante.',
    );
  });

  it('galeria negada: não abre a galeria e explica como liberar (AC 2)', async () => {
    mockPermissaoGaleria.mockResolvedValue({ granted: false });
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Galeria');

    expect(mockGaleria).not.toHaveBeenCalled();
    expect(onErro).toHaveBeenCalledWith(
      'Sem acesso à galeria. Libere a permissão nos ajustes do aparelho para escolher o comprovante.',
    );
  });

  it('falha no upload: repassa a mensagem, não muda o campo e volta o botão (AC 7)', async () => {
    mockCamera.mockResolvedValue(foto(4000));
    mockUpload.mockResolvedValue({ ok: false, mensagem: 'Não foi possível enviar o comprovante. Tente novamente.' });
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Câmera');

    expect(onErro).toHaveBeenCalledWith('Não foi possível enviar o comprovante. Tente novamente.');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Anexar comprovante' })).toBeOnTheScreen();
  });

  it('falha ao comprimir: mensagem em português, sem enviar', async () => {
    mockCamera.mockResolvedValue(foto(4000));
    contexto.renderAsync.mockRejectedValue(new Error('detalhe técnico'));
    renderAnexo();

    fireEvent.press(screen.getByRole('button', { name: 'Anexar comprovante' }));
    await escolherNoAlerta('Câmera');

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onErro).toHaveBeenCalledWith('Não foi possível preparar a imagem. Tente outra foto.');
  });
});

describe('AnexoComprovante — com anexo (EIX-34)', () => {
  it('pede a signed URL do caminho e mostra a miniatura (AC 5)', async () => {
    renderAnexo('antigo.jpg');

    await esperarMiniatura();
    expect(mockUrl).toHaveBeenCalledWith('antigo.jpg');
    expect(screen.getByText('Comprovante anexado')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Anexar comprovante' })).not.toBeOnTheScreen();
  });

  it('tocar na miniatura abre a imagem em tela cheia, e "Fechar" volta (AC 5)', async () => {
    renderAnexo('antigo.jpg');

    fireEvent.press(await esperarMiniatura());
    expect(screen.getByLabelText('Comprovante')).toHaveProp('source', { uri: 'https://assinada.example/antigo.jpg' });

    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByLabelText('Comprovante')).not.toBeOnTheScreen();
  });

  it('falha ao gerar a signed URL vira mensagem de erro', async () => {
    mockUrl.mockResolvedValue({ ok: false, mensagem: 'Não foi possível abrir o comprovante.' });
    renderAnexo('antigo.jpg');

    await waitFor(() => expect(onErro).toHaveBeenCalledWith('Não foi possível abrir o comprovante.'));
    expect(screen.getByRole('imagebutton', { name: 'Ver comprovante em tela cheia' })).toBeDisabled();
  });

  it('remover pede confirmação e só então limpa o campo (AC 6)', async () => {
    renderAnexo('antigo.jpg');
    await esperarMiniatura();

    fireEvent.press(screen.getByRole('button', { name: 'Remover' }));
    expect(onChange).not.toHaveBeenCalled();

    await escolherNoAlerta('Remover');
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
