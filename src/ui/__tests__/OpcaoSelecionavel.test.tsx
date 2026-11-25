import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar, iniciais } from '../Avatar';
import { OpcaoSelecionavel } from '../OpcaoSelecionavel';
import { colors } from '../tokens';

describe('OpcaoSelecionavel', () => {
  it('é um rádio com título e descrição no nome; tocar chama onPress', async () => {
    const onPress = jest.fn();
    await render(<OpcaoSelecionavel titulo="Financeiro" descricao="Caixa e dívidas" selecionada={false} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Financeiro. Caixa e dívidas' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('selecionada: estado checked, fundo accentSoft e círculo cheio (cor nunca é o único indicador)', async () => {
    await render(<OpcaoSelecionavel titulo="Saída" selecionada onPress={jest.fn()} />);

    const opcao = screen.getByRole('radio', { name: 'Saída' });
    expect(opcao).toBeChecked();
    expect(opcao).toHaveStyle({ backgroundColor: colors.accentSoft, borderColor: colors.accentStrong });
    expect(screen.getByTestId('opcao-radio-marcado')).toBeOnTheScreen();
  });

  it('não selecionada: círculo vazio com borda de 3:1 (textBody), sem o miolo', async () => {
    await render(<OpcaoSelecionavel titulo="Entrada" selecionada={false} onPress={jest.fn()} />);

    expect(screen.getByRole('radio', { name: 'Entrada' })).not.toBeChecked();
    expect(screen.getByTestId('opcao-radio')).toHaveStyle({ borderColor: colors.textBody });
    expect(screen.queryByTestId('opcao-radio-marcado')).not.toBeOnTheScreen();
  });

  it('desabilitada: não responde ao toque', async () => {
    const onPress = jest.fn();
    await render(<OpcaoSelecionavel titulo="Admin" selecionada={false} onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Admin' }));

    expect(screen.getByRole('radio', { name: 'Admin' })).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Avatar — iniciais', () => {
  it.each([
    ['Jean Ribeiro', 'JR'],
    ['Carlos Almeida Souza', 'CS'],
    ['Ana', 'A'],
    ['frotas@eixocerto.com.br', 'F'],
    ['   ', '?'],
    ['Diogo _Fune', 'DF'],
    ['_ 123', '?'],
  ])('%s → %s', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });

  it('sem foto, mostra as iniciais; no tamanho sm o círculo é menor', async () => {
    await render(<Avatar name="Jean Ribeiro" photoUrl={null} size="sm" />);

    expect(screen.getByLabelText('Iniciais de Jean Ribeiro')).toHaveTextContent('JR');
    expect(screen.getByLabelText('Iniciais de Jean Ribeiro')).toHaveStyle({ width: 40, height: 40 });
  });
});
