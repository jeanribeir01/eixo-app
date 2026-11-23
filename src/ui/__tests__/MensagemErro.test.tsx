import { render, screen } from '@testing-library/react-native';

import { CampoData } from '../CampoData';
import { MensagemErro } from '../MensagemErro';
import { Select } from '../Select';
import { colors } from '../tokens';

// Erro de campo igual em todo formulário (auditoria de UI, item 14): ícone de alerta + texto em danger,
// anunciado como alerta. Antes era texto preto, igual ao texto comum.
describe('MensagemErro', () => {
  it('mostra o texto em danger com role de alerta e o ícone de alerta decorativo', () => {
    render(<MensagemErro>Informe a placa.</MensagemErro>);

    expect(screen.getByRole('alert')).toHaveTextContent('Informe a placa.');
    expect(screen.getByRole('alert')).toHaveStyle({ color: colors.danger });
    expect(screen.queryByTestId('icone-alerta')).not.toBeOnTheScreen();
    expect(screen.getByTestId('icone-alerta', { includeHiddenElements: true })).toHaveStyle({ color: colors.danger });
  });

  it('Select e CampoData usam a mesma mensagem que o Input', () => {
    render(
      <>
        <Select label="Veículo" value={null} options={[]} onChange={jest.fn()} error="Escolha o veículo." />
        <CampoData label="Vencimento" value="" onChange={jest.fn()} error="Informe a data." />
      </>,
    );

    const alertas = screen.getAllByRole('alert');
    expect(alertas.map((alerta) => alerta.props.children)).toEqual(['Escolha o veículo.', 'Informe a data.']);
    alertas.forEach((alerta) => expect(alerta).toHaveStyle({ color: colors.danger }));
  });
});
