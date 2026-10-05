import { fireEvent, render, screen } from '@testing-library/react-native';

import { CampoData } from '../components/CampoData';

describe('CampoData (MOV-05)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('aplica a máscara DD/MM/AAAA enquanto digita', () => {
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="" onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText('Data de vencimento'), '05102026');

    expect(onChange).toHaveBeenCalledWith('05/10/2026');
  });

  it('"Hoje" preenche com a data local do aparelho', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 5, 23, 30));
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="" onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'Hoje' }));

    expect(onChange).toHaveBeenCalledWith('05/10/2026');
  });

  it('mostra o valor atual, o placeholder e o erro', () => {
    render(<CampoData label="Data de vencimento" value="05/10" onChange={jest.fn()} error="Data inválida. Use DD/MM/AAAA." />);

    expect(screen.getByLabelText('Data de vencimento')).toHaveDisplayValue('05/10');
    expect(screen.getByPlaceholderText('DD/MM/AAAA')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent('Data inválida. Use DD/MM/AAAA.');
  });
});
