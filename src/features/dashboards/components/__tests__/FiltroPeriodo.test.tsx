import { DateTimePickerAndroid, type AndroidNativeProps } from '@react-native-community/datetimepicker';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { periodoDoAno, periodoDoMes, type Periodo } from '../../periodo';
import { FiltroPeriodo } from '../FiltroPeriodo';

jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

const mockOpen = DateTimePickerAndroid.open as jest.MockedFunction<typeof DateTimePickerAndroid.open>;
const onChange = jest.fn();

// A tela real guarda o período: o teste faz o mesmo para o filtro reagir como no app.
function Controlado({ inicial }: { inicial: Periodo }) {
  const [periodo, setPeriodo] = useState(inicial);
  return (
    <FiltroPeriodo
      value={periodo}
      onChange={(novo) => {
        onChange(novo);
        setPeriodo(novo);
      }}
    />
  );
}

function tocarAba(nome: string) {
  fireEvent.press(screen.getByRole('tab', { name: nome }));
}

function aplicar() {
  fireEvent.press(screen.getByRole('button', { name: 'Aplicar período' }));
}

beforeEach(() => {
  onChange.mockReset();
  mockOpen.mockReset();
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 8, 12));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('FiltroPeriodo', () => {
  // No iOS o campo de data é digitado, o que deixa estes testes mais diretos. O caminho do Android, que é
  // a plataforma desta fase (AD-003), tem o próprio bloco abaixo.
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  function preencher(rotulo: string, digitos: string) {
    fireEvent.changeText(screen.getByLabelText(rotulo), digitos);
  }

  it('mostra as três opções e o mês selecionado', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);

    expect(screen.getByRole('tab', { name: 'Mês' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Ano' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Período' })).toBeOnTheScreen();
    expect(screen.getByText('Novembro 2026')).toBeOnTheScreen();
  });

  it('as setas trocam o mês, inclusive na virada do ano', () => {
    render(<Controlado inicial={periodoDoMes(2026, 12)} />);

    fireEvent.press(screen.getByRole('button', { name: 'Próximo mês' }));

    expect(onChange).toHaveBeenLastCalledWith(periodoDoMes(2027, 1));
    expect(screen.getByText('Janeiro 2027')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Mês anterior' }));

    expect(onChange).toHaveBeenLastCalledWith(periodoDoMes(2026, 12));
  });

  it('aba Ano usa o ano do mês em uso e as setas trocam o ano', () => {
    render(<Controlado inicial={periodoDoMes(2026, 3)} />);

    tocarAba('Ano');

    expect(onChange).toHaveBeenLastCalledWith(periodoDoAno(2026));
    expect(screen.getByText('2026')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Ano anterior' }));

    expect(onChange).toHaveBeenLastCalledWith(periodoDoAno(2025));
  });

  it('trocar entre Mês e Ano mantém o período navegado, não volta para hoje', () => {
    render(<Controlado inicial={periodoDoMes(2024, 3)} />);

    tocarAba('Ano');

    expect(onChange).toHaveBeenLastCalledWith(periodoDoAno(2024));

    tocarAba('Mês');

    // O mês de hoje (novembro) dentro do ano navegado.
    expect(onChange).toHaveBeenLastCalledWith(periodoDoMes(2024, 11));
    expect(screen.getByText('Novembro 2024')).toBeOnTheScreen();
  });

  it('acompanha o período quando a tela o troca por conta própria', () => {
    const { rerender } = render(<FiltroPeriodo value={periodoDoMes(2026, 11)} onChange={onChange} />);

    rerender(<FiltroPeriodo value={periodoDoAno(2026)} onChange={onChange} />);

    expect(screen.getByRole('tab', { name: 'Ano' })).toBeSelected();
    expect(screen.getByText('2026')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Ano anterior' }));

    expect(onChange).toHaveBeenLastCalledWith(periodoDoAno(2025));
  });

  it('abrir a aba Período não muda o filtro, traz as datas em uso e avisa qual período vale', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);

    tocarAba('Período');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Data inicial')).toHaveDisplayValue('01/11/2026');
    expect(screen.getByLabelText('Data final')).toHaveDisplayValue('30/11/2026');
    expect(screen.getByText('Em uso: Novembro 2026. Toque em "Aplicar período" para trocar.')).toBeOnTheScreen();
  });

  it('tocar de novo na aba Período não apaga as datas digitadas', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');
    preencher('Data inicial', '01102026');

    tocarAba('Período');

    expect(screen.getByLabelText('Data inicial')).toHaveDisplayValue('01/10/2026');
  });

  it('voltar da aba Período sem aplicar mantém o mês navegado', () => {
    render(<Controlado inicial={periodoDoMes(2026, 3)} />);

    tocarAba('Período');
    tocarAba('Mês');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Março 2026')).toBeOnTheScreen();
  });

  it('aplicar um período válido devolve as datas em ISO e tira o aviso', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '01102026');
    preencher('Data final', '15102026');
    aplicar();

    expect(onChange).toHaveBeenCalledWith({ modo: 'customizado', dataInicial: '2026-10-01', dataFinal: '2026-10-15' });
    expect(screen.getByRole('tab', { name: 'Período' })).toBeSelected();
    expect(screen.queryByText(/^Em uso:/)).not.toBeOnTheScreen();
  });

  it('editar um período já aplicado avisa até aplicar de novo', () => {
    render(<Controlado inicial={{ modo: 'customizado', dataInicial: '2026-10-01', dataFinal: '2026-10-15' }} />);

    preencher('Data final', '20102026');

    expect(
      screen.getByText('Em uso: 01/10/2026 a 15/10/2026. Toque em "Aplicar período" para trocar.'),
    ).toBeOnTheScreen();
  });

  it('data final anterior à inicial mostra o erro e não aplica', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '15102026');
    preencher('Data final', '01102026');
    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('A data final não pode ser anterior à data inicial.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('período maior que 366 dias mostra o erro e não aplica', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '01011900');
    preencher('Data final', '31129999');
    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('O período pode ter no máximo 366 dias.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('data vazia mostra o erro em português e não aplica', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '');
    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('Informe a data inicial.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sair da aba Período limpa os erros', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');
    preencher('Data inicial', '');
    aplicar();

    tocarAba('Mês');
    tocarAba('Período');

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });
});

describe('FiltroPeriodo no Android — calendário nativo', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  // Toca no campo e confirma a data no calendário nativo, como o usuário faz no aparelho.
  function escolherNoCalendario(rotulo: string, data: Date) {
    fireEvent.press(screen.getByRole('button', { name: rotulo }));
    const abertura: AndroidNativeProps = mockOpen.mock.calls[mockOpen.mock.calls.length - 1][0];
    // Fora de um toque, a atualização de estado precisa do act para chegar à tela.
    act(() => abertura.onChange?.({ type: 'set', nativeEvent: { timestamp: data.getTime(), utcOffset: 0 } }, data));
  }

  it('aplica o período escolhido no calendário', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    escolherNoCalendario('Data inicial', new Date(2026, 9, 1));
    escolherNoCalendario('Data final', new Date(2026, 9, 15));
    aplicar();

    expect(onChange).toHaveBeenCalledWith({ modo: 'customizado', dataInicial: '2026-10-01', dataFinal: '2026-10-15' });
  });

  it('o calendário abre na data em uso do campo', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    fireEvent.press(screen.getByRole('button', { name: 'Data final' }));

    expect(mockOpen.mock.calls[0][0].value).toEqual(new Date(2026, 10, 30));
  });

  it('"Limpar data" e aplicar mostra o erro de campo vazio e não aplica', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    // Os dois campos já vêm preenchidos; o primeiro "Limpar data" é o da data inicial.
    fireEvent.press(screen.getAllByRole('button', { name: 'Limpar data' })[0]);
    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('Informe a data inicial.');
    expect(onChange).not.toHaveBeenCalled();
  });
});
