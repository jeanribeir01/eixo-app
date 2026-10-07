import { fireEvent, render, screen } from '@testing-library/react-native';

import { Select } from '../Select';
import { touchTarget } from '../tokens';

const opcoes = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto', description: 'Compensa em até 3 dias' },
];

function abrir() {
  fireEvent.press(screen.getByRole('button', { name: 'Forma de pagamento' }));
}

describe('Select', () => {
  it('mostra o rótulo e o placeholder quando nada foi escolhido', () => {
    render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} placeholder="Escolha" />);

    expect(screen.getByText('Forma de pagamento')).toBeOnTheScreen();
    expect(screen.getByText('Escolha')).toBeOnTheScreen();
    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();
  });

  it('mostra o rótulo da opção escolhida', () => {
    render(<Select label="Forma de pagamento" value="boleto" options={opcoes} onChange={jest.fn()} />);

    expect(screen.getByText('Boleto')).toBeOnTheScreen();
  });

  it('abre a lista com as opções e a descrição de cada uma', () => {
    render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} />);

    abrir();

    expect(screen.getByRole('button', { name: 'Pix' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Boleto' })).toBeOnTheScreen();
    expect(screen.getByText('Compensa em até 3 dias')).toBeOnTheScreen();
  });

  it('escolher uma opção chama onChange com o valor e fecha a lista', () => {
    const onChange = jest.fn();
    render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={onChange} />);

    abrir();
    fireEvent.press(screen.getByRole('button', { name: 'Boleto' }));

    expect(onChange).toHaveBeenCalledWith('boleto');
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeOnTheScreen();
  });

  it('Cancelar fecha a lista sem mudar o valor', () => {
    const onChange = jest.fn();
    render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={onChange} />);

    abrir();
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Pix' })).not.toBeOnTheScreen();
  });

  it('mostra a mensagem de erro abaixo do campo', () => {
    render(
      <Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} error="Escolha a forma de pagamento." />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a forma de pagamento.');
  });

  it('lista vazia mostra a mensagem de vazio', () => {
    render(
      <Select label="Forma de pagamento" value={null} options={[]} onChange={jest.fn()} emptyMessage="Nenhuma opção cadastrada." />,
    );

    abrir();

    expect(screen.getByText('Nenhuma opção cadastrada.')).toBeOnTheScreen();
  });

  it('valor fora das opções (item inativo) usa o fallbackLabel', () => {
    render(
      <Select label="Forma de pagamento" value="cheque" options={opcoes} onChange={jest.fn()} fallbackLabel="Cheque" />,
    );

    expect(screen.getByText('Cheque')).toBeOnTheScreen();
  });

  it('desabilitado não abre a lista', () => {
    render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} disabled />);

    abrir();

    expect(screen.queryByRole('button', { name: 'Pix' })).not.toBeOnTheScreen();
  });

  it('campo e opções respeitam o alvo de toque de 44pt', () => {
    render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Forma de pagamento' })).toHaveStyle({ minHeight: touchTarget });
    abrir();
    expect(screen.getByRole('button', { name: 'Pix' })).toHaveStyle({ minHeight: touchTarget });
  });
});
