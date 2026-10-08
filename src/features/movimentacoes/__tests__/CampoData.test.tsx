import { DateTimePickerAndroid, type AndroidNativeProps } from '@react-native-community/datetimepicker';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { CampoData } from '../components/CampoData';

jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

const mockOpen = DateTimePickerAndroid.open as jest.MockedFunction<typeof DateTimePickerAndroid.open>;

// O que o calendário recebeu na última abertura.
function ultimaAbertura(): AndroidNativeProps {
  return mockOpen.mock.calls[mockOpen.mock.calls.length - 1][0];
}

// Simula o usuário fechando o calendário: "set" é confirmar, "dismissed" é cancelar.
function responderCalendario(tipo: 'set' | 'dismissed', data?: Date) {
  ultimaAbertura().onChange?.({ type: tipo, nativeEvent: { timestamp: data?.getTime() ?? 0, utcOffset: 0 } }, data);
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  mockOpen.mockReset();
});

describe('CampoData no Android — calendário nativo (DAT-01)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('tocar no campo abre o calendário na data do campo (AC 1)', () => {
    render(<CampoData label="Data de vencimento" value="05/10/2026" onChange={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Data de vencimento' }));

    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(ultimaAbertura().mode).toBe('date');
    expect(ultimaAbertura().value).toEqual(new Date(2026, 9, 5));
  });

  it('campo vazio abre o calendário em hoje (AC 1)', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 8, 23, 30));
    render(<CampoData label="Data de vencimento" value="" onChange={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Data de vencimento' }));

    const inicial = ultimaAbertura().value;
    expect([inicial.getFullYear(), inicial.getMonth(), inicial.getDate()]).toEqual([2026, 9, 8]);
  });

  it('confirmar 05/10/2026 chama onChange("05/10/2026") (AC 2)', () => {
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="" onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: 'Data de vencimento' }));

    // 23h30: em UTC já seria dia 06. O campo usa a data local do aparelho.
    responderCalendario('set', new Date(2026, 9, 5, 23, 30));

    expect(onChange).toHaveBeenCalledWith('05/10/2026');
  });

  it('cancelar não chama onChange e mantém o valor (AC 3)', () => {
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="01/10/2026" onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: 'Data de vencimento' }));

    responderCalendario('dismissed');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('"Limpar data" esvazia o campo (AC 4)', () => {
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="05/10/2026" onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'Limpar data' }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it('sem data, não mostra "Limpar data" (AC 4)', () => {
    render(<CampoData label="Data de vencimento" value="" onChange={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Limpar data' })).not.toBeOnTheScreen();
  });

  it('o campo mostra a data, não abre o teclado e o leitor de tela ouve a data pelo botão', () => {
    render(<CampoData label="Data de vencimento" value="05/10/2026" onChange={jest.fn()} />);

    const campo = screen.getByDisplayValue('05/10/2026', { includeHiddenElements: true });
    expect(campo.props.editable).toBe(false);
    expect(screen.getByRole('button', { name: 'Data de vencimento' })).toHaveAccessibilityValue({ text: '05/10/2026' });
  });

  it('mostra o erro da validação', () => {
    render(<CampoData label="Data de vencimento" value="" onChange={jest.fn()} error="Informe a data de vencimento." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Informe a data de vencimento.');
  });

  it('"Hoje" continua preenchendo com a data local do aparelho', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 5, 23, 30));
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="" onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'Hoje' }));

    expect(onChange).toHaveBeenCalledWith('05/10/2026');
  });
});

describe('CampoData no iOS — máscara (MOV-05)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('aplica a máscara DD/MM/AAAA enquanto digita', () => {
    const onChange = jest.fn();
    render(<CampoData label="Data de vencimento" value="" onChange={onChange} />);

    fireEvent.changeText(screen.getByLabelText('Data de vencimento'), '05102026');

    expect(onChange).toHaveBeenCalledWith('05/10/2026');
    expect(mockOpen).not.toHaveBeenCalled();
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
