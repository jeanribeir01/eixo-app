import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { periodoDoAno, periodoDoMes, type Periodo } from '../../periodo';
import { FiltroPeriodo } from '../FiltroPeriodo';

jest.mock('@react-native-community/datetimepicker', () => ({ DateTimePickerAndroid: { open: jest.fn() } }));

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

function preencher(rotulo: string, digitos: string) {
  fireEvent.changeText(screen.getByLabelText(rotulo), digitos);
}

beforeEach(() => {
  onChange.mockReset();
  // No iOS o campo é digitado; no Android abriria o calendário nativo.
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 8, 12));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('FiltroPeriodo', () => {
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

  it('aba Ano aplica o ano atual e as setas trocam o ano', () => {
    render(<Controlado inicial={periodoDoMes(2026, 3)} />);

    tocarAba('Ano');

    expect(onChange).toHaveBeenLastCalledWith(periodoDoAno(2026));
    expect(screen.getByText('2026')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Ano anterior' }));

    expect(onChange).toHaveBeenLastCalledWith(periodoDoAno(2025));
  });

  it('abrir a aba Período não muda o filtro e traz as datas em uso', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);

    tocarAba('Período');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Data inicial')).toHaveDisplayValue('01/11/2026');
    expect(screen.getByLabelText('Data final')).toHaveDisplayValue('30/11/2026');
  });

  it('voltar da aba Período sem aplicar mantém o mês navegado', () => {
    render(<Controlado inicial={periodoDoMes(2026, 3)} />);

    tocarAba('Período');
    tocarAba('Mês');

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Março 2026')).toBeOnTheScreen();
  });

  it('aplicar um período válido devolve as datas em ISO', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '01102026');
    preencher('Data final', '15102026');
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar período' }));

    expect(onChange).toHaveBeenCalledWith({ modo: 'customizado', dataInicial: '2026-10-01', dataFinal: '2026-10-15' });
  });

  it('data final anterior à inicial mostra o erro e não aplica', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '15102026');
    preencher('Data final', '01102026');
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar período' }));

    expect(screen.getByRole('alert')).toHaveTextContent('A data final não pode ser anterior à data inicial.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('data vazia mostra o erro em português e não aplica', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');

    preencher('Data inicial', '');
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar período' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Informe a data inicial.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sair da aba Período limpa os erros', () => {
    render(<Controlado inicial={periodoDoMes(2026, 11)} />);
    tocarAba('Período');
    preencher('Data inicial', '');
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar período' }));

    tocarAba('Mês');
    tocarAba('Período');

    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });
});
