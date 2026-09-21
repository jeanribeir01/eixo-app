import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ListItem } from '../ListItem';

describe('ListItem', () => {
  it('renderiza o conteúdo sem virar botão quando não tem onPress', () => {
    render(
      <ListItem>
        <Text>Combustível</Text>
      </ListItem>,
    );

    expect(screen.getByText('Combustível')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('com onPress, vira botão acessível e dispara a ação', () => {
    const onPress = jest.fn();
    render(
      <ListItem onPress={onPress} accessibilityLabel="Editar Combustível">
        <Text>Combustível</Text>
      </ListItem>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Editar Combustível' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
