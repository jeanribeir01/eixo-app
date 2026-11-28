import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Modal } from 'react-native';

import { porTipo } from '@/testing/componentes';

import { FolhaDeConfirmacao, FolhaDeEscolha } from '../Folha';
import { colors, radius } from '../tokens';

function folha() {
  return within(screen.getByTestId('folha'));
}

describe('FolhaDeConfirmacao', () => {
  const onConfirmar = jest.fn();
  const onCancelar = jest.fn();

  beforeEach(() => {
    onConfirmar.mockReset();
    onCancelar.mockReset();
  });

  async function renderFolha(visivel = true, tom?: 'primary' | 'danger') {
    await render(
      <FolhaDeConfirmacao
        visivel={visivel}
        titulo="Excluir movimentação?"
        mensagem="Diesel. A exclusão não pode ser desfeita."
        rotuloConfirmar="Excluir"
        tom={tom}
        onConfirmar={onConfirmar}
        onCancelar={onCancelar}
      />,
    );
  }

  it('fechada, não aparece na tela', async () => {
    await renderFolha(false);

    expect(screen.queryByTestId('folha')).not.toBeOnTheScreen();
  });

  it('aberta: título como cabeçalho, o que acontece, a ação e "Cancelar", nessa ordem', async () => {
    await renderFolha();

    expect(folha().getByRole('header')).toHaveTextContent('Excluir movimentação?');
    expect(folha().getByText('Diesel. A exclusão não pode ser desfeita.')).toBeOnTheScreen();
    expect(folha().getAllByRole('button').map((botao) => botao.props.accessibilityLabel)).toEqual(['Excluir', 'Cancelar']);
  });

  it('a folha tem o canto do guia 2.0 (radius.sheet) e fundo surface, como o seletor', async () => {
    await renderFolha();

    expect(screen.getByTestId('folha')).toHaveStyle({
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
    });
  });

  it('o botão da ação chama onConfirmar; "Cancelar" chama onCancelar', async () => {
    await renderFolha();

    await fireEvent.press(folha().getByRole('button', { name: 'Excluir' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onCancelar).not.toHaveBeenCalled();

    await fireEvent.press(folha().getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('o voltar do Android cancela', async () => {
    await renderFolha();

    // O voltar do Android chega ao Modal como onRequestClose (o evento não importa aqui).
    const voltar = porTipo(Modal).props.onRequestClose as (() => void) | undefined;
    voltar?.();

    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('tom danger: o botão da ação no estilo de perigo, nunca o azul da ação principal', async () => {
    await renderFolha(true, 'danger');

    expect(folha().getByRole('button', { name: 'Excluir' })).toHaveStyle({ backgroundColor: colors.dangerWash });
  });
});

describe('FolhaDeEscolha', () => {
  const csv = jest.fn();
  const pdf = jest.fn();
  const onCancelar = jest.fn();

  beforeEach(() => {
    csv.mockReset();
    pdf.mockReset();
    onCancelar.mockReset();
  });

  async function renderFolha() {
    await render(
      <FolhaDeEscolha
        visivel
        titulo="Exportar relatório"
        mensagem="Em qual formato?"
        opcoes={[
          { rotulo: 'Planilha (CSV)', descricao: 'Abre no Excel', icone: 'planilha', onPress: csv },
          { rotulo: 'PDF', icone: 'pdf', onPress: pdf },
        ]}
        onCancelar={onCancelar}
      />,
    );
  }

  it('uma linha por opção, com ícone e descrição, e "Cancelar" no fim', async () => {
    await renderFolha();

    expect(folha().getAllByRole('button').map((botao) => botao.props.accessibilityLabel)).toEqual([
      'Planilha (CSV)',
      'PDF',
      'Cancelar',
    ]);
    expect(folha().getByText('Abre no Excel')).toBeOnTheScreen();
    expect(folha().getByTestId('icone-planilha', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('escolher não leva a outra tela: as linhas não têm a seta de "abrir"', async () => {
    await renderFolha();

    expect(folha().queryByTestId('icone-avancar', { includeHiddenElements: true })).not.toBeOnTheScreen();
  });

  it('tocar numa opção chama só a dela', async () => {
    await renderFolha();

    await fireEvent.press(folha().getByRole('button', { name: 'PDF' }));

    expect(pdf).toHaveBeenCalledTimes(1);
    expect(csv).not.toHaveBeenCalled();
    expect(onCancelar).not.toHaveBeenCalled();
  });
});
