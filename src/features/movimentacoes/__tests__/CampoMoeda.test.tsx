import { fireEvent, render, screen } from '@testing-library/react-native';

import { CampoMoeda } from '../components/CampoMoeda';

describe('CampoMoeda (MOV-03)', () => {
  it('digitar 1234 devolve 1234 centavos', () => {
    const onChange = jest.fn();
    render(<CampoMoeda label="Valor" valorCentavos={0} onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText('Valor'), '1234');

    expect(onChange).toHaveBeenCalledWith(1234);
  });

  it('mostra o valor formatado em R$', () => {
    render(<CampoMoeda label="Valor" valorCentavos={1234} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Valor')).toHaveDisplayValue('R$ 12,34');
  });

  it('apagar um dígito do texto formatado recua uma casa', () => {
    const onChange = jest.fn();
    render(<CampoMoeda label="Valor" valorCentavos={1234} onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText('Valor'), 'R$ 12,3');

    expect(onChange).toHaveBeenCalledWith(123);
  });

  it('zero mostra o campo vazio, com placeholder R$ 0,00', () => {
    render(<CampoMoeda label="Valor" valorCentavos={0} onChange={jest.fn()} />);

    expect(screen.getByLabelText('Valor')).toHaveDisplayValue('');
    expect(screen.getByPlaceholderText('R$ 0,00')).toBeOnTheScreen();
  });

  it('mostra a mensagem de erro', () => {
    render(<CampoMoeda label="Valor" valorCentavos={0} onChange={jest.fn()} error="Informe um valor maior que zero." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um valor maior que zero.');
  });
});
