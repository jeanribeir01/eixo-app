import { fireEvent, render, screen } from '@testing-library/react-native';

import { Select } from '../Select';
import { controlHeight, touchTarget } from '../tokens';

const opcoes = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto', description: 'Compensa em até 3 dias' },
];

async function abrir() {
  await fireEvent.press(screen.getByRole('button', { name: 'Forma de pagamento' }));
}

describe('Select', () => {
  it('mostra o rótulo e o placeholder quando nada foi escolhido', async () => {
    await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} placeholder="Escolha" />);

    expect(screen.getByText('Forma de pagamento')).toBeOnTheScreen();
    expect(screen.getByText('Escolha')).toBeOnTheScreen();
    expect(screen.queryByText('Pix')).not.toBeOnTheScreen();
  });

  it('mostra o rótulo da opção escolhida', async () => {
    await render(<Select label="Forma de pagamento" value="boleto" options={opcoes} onChange={jest.fn()} />);

    expect(screen.getByText('Boleto')).toBeOnTheScreen();
  });

  it('abre a lista com as opções e a descrição de cada uma', async () => {
    await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} />);

    await abrir();

    expect(screen.getByRole('button', { name: 'Pix' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Boleto' })).toBeOnTheScreen();
    expect(screen.getByText('Compensa em até 3 dias')).toBeOnTheScreen();
  });

  it('escolher uma opção chama onChange com o valor e fecha a lista', async () => {
    const onChange = jest.fn();
    await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={onChange} />);

    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Boleto' }));

    expect(onChange).toHaveBeenCalledWith('boleto');
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeOnTheScreen();
  });

  it('Cancelar fecha a lista sem mudar o valor', async () => {
    const onChange = jest.fn();
    await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={onChange} />);

    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Pix' })).not.toBeOnTheScreen();
  });

  it('mostra a mensagem de erro abaixo do campo', async () => {
    await render(
      <Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} error="Escolha a forma de pagamento." />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a forma de pagamento.');
  });

  it('lista vazia mostra a mensagem de vazio', async () => {
    await render(
      <Select label="Forma de pagamento" value={null} options={[]} onChange={jest.fn()} emptyMessage="Nenhuma opção cadastrada." />,
    );

    await abrir();

    expect(screen.getByText('Nenhuma opção cadastrada.')).toBeOnTheScreen();
  });

  it('valor fora das opções (item inativo) usa o fallbackLabel', async () => {
    await render(
      <Select label="Forma de pagamento" value="cheque" options={opcoes} onChange={jest.fn()} fallbackLabel="Cheque" />,
    );

    expect(screen.getByText('Cheque')).toBeOnTheScreen();
  });

  it('desabilitado não abre a lista', async () => {
    await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} disabled />);

    await abrir();

    expect(screen.queryByRole('button', { name: 'Pix' })).not.toBeOnTheScreen();
  });

  it('campo com 48pt, igual ao Input, e opções com o alvo de toque de 44pt', async () => {
    await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Forma de pagamento' })).toHaveStyle({ minHeight: controlHeight });
    await abrir();
    expect(screen.getByRole('button', { name: 'Pix' })).toHaveStyle({ minHeight: touchTarget });
  });

  describe('busca (searchable)', () => {
    const viagens = [
      { value: 'v1', label: 'ABC1D23 · São Paulo/SP → Curitiba/PR', description: 'Em andamento' },
      { value: 'v2', label: 'XYZ9K88 · Campinas/SP → Belo Horizonte/MG', description: 'Concluída' },
    ];

    async function abrirViagens() {
      await fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));
    }

    it('sem searchable não mostra o campo de busca', async () => {
      await render(<Select label="Forma de pagamento" value={null} options={opcoes} onChange={jest.fn()} />);

      await abrir();

      expect(screen.queryByLabelText('Buscar')).not.toBeOnTheScreen();
    });

    it('filtra por parte do rótulo, sem diferenciar maiúsculas nem acentos', async () => {
      await render(<Select label="Vincular à viagem" value={null} options={viagens} onChange={jest.fn()} searchable />);

      await abrirViagens();
      await fireEvent.changeText(screen.getByLabelText('Buscar'), 'sao paulo');

      expect(screen.getByRole('button', { name: viagens[0]!.label })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: viagens[1]!.label })).not.toBeOnTheScreen();
    });

    it('filtra pela placa', async () => {
      await render(<Select label="Vincular à viagem" value={null} options={viagens} onChange={jest.fn()} searchable />);

      await abrirViagens();
      await fireEvent.changeText(screen.getByLabelText('Buscar'), 'xyz9');

      expect(screen.getByRole('button', { name: viagens[1]!.label })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: viagens[0]!.label })).not.toBeOnTheScreen();
    });

    it('busca sem resultado mostra a mensagem de nenhum resultado', async () => {
      await render(
        <Select
          label="Vincular à viagem"
          value={null}
          options={viagens}
          onChange={jest.fn()}
          searchable
          noResultsMessage="Nenhuma viagem encontrada."
        />,
      );

      await abrirViagens();
      await fireEvent.changeText(screen.getByLabelText('Buscar'), 'Manaus');

      expect(screen.getByText('Nenhuma viagem encontrada.')).toBeOnTheScreen();
    });

    it('reabrir a lista começa sem o texto da busca anterior', async () => {
      await render(<Select label="Vincular à viagem" value={null} options={viagens} onChange={jest.fn()} searchable />);

      await abrirViagens();
      await fireEvent.changeText(screen.getByLabelText('Buscar'), 'xyz9');
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
      await abrirViagens();

      expect(screen.getByRole('button', { name: viagens[0]!.label })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: viagens[1]!.label })).toBeOnTheScreen();
    });
  });

  describe('opção de limpar (clearLabel)', () => {
    it('sem valor escolhido mostra o clearLabel no campo', async () => {
      await render(
        <Select label="Vincular à viagem" value={null} options={opcoes} onChange={jest.fn()} clearLabel="Sem viagem" onClear={jest.fn()} />,
      );

      expect(screen.getByText('Sem viagem')).toBeOnTheScreen();
    });

    it('a primeira linha da lista chama onClear, não onChange, e fecha a lista', async () => {
      const onChange = jest.fn();
      const onClear = jest.fn();
      await render(
        <Select label="Vincular à viagem" value="pix" options={opcoes} onChange={onChange} clearLabel="Sem viagem" onClear={onClear} />,
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Sem viagem' }));

      expect(onClear).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeOnTheScreen();
    });

    it('com a lista vazia mostra a linha de limpar e a mensagem de vazio', async () => {
      await render(
        <Select
          label="Vincular à viagem"
          value={null}
          options={[]}
          onChange={jest.fn()}
          clearLabel="Sem viagem"
          onClear={jest.fn()}
          emptyMessage="Nenhuma viagem em andamento ou concluída nos últimos 30 dias."
        />,
      );

      await fireEvent.press(screen.getByRole('button', { name: 'Vincular à viagem' }));

      // Por rótulo: o campo também mostra "Sem viagem" como texto, mas o rótulo dele é "Vincular à viagem".
      expect(screen.getByLabelText('Sem viagem')).toBeOnTheScreen();
      expect(screen.getByText('Nenhuma viagem em andamento ou concluída nos últimos 30 dias.')).toBeOnTheScreen();
    });
  });
});
