import { useState } from 'react';

import { Button, Column, Screen, Text } from '@/ui';

import { authErrorMessage } from './errors';
import { signInWithGoogle } from './googleAuth';

export function LoginView() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGooglePress() {
    setIsLoading(true);
    setErrorMessage(null);

    const result = await signInWithGoogle();

    // Em caso de sucesso não fazemos nada aqui: a sessão nova dispara o redirect no layout raiz,
    // e o botão continua em loading até a Home aparecer (evita "piscar" o botão habilitado).
    if (!result.ok) {
      setErrorMessage(authErrorMessage(result.code));
      setIsLoading(false);
    }
  }

  return (
    <Screen align="center">
      <Text variant="bodySm" weight="medium">
        Eixo Certo
      </Text>

      <Column gap="sm">
        <Text variant="display">Entre para continuar</Text>
        <Text tone="body">Use sua conta Google para acessar a gestão financeira e a frota da empresa.</Text>
      </Column>

      <Button label="Continuar com Google" onPress={handleGooglePress} loading={isLoading} />

      {errorMessage && (
        // role "alert" faz o leitor de tela anunciar o erro assim que ele aparece.
        <Text accessibilityRole="alert" variant="bodySm">
          {errorMessage}
        </Text>
      )}
    </Screen>
  );
}
