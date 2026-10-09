import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Button, Column, Input, Logo, Screen, Text, spacing } from '@/ui';

import { loginEmailHabilitado, signInWithEmail } from './emailAuth';
import { authErrorMessage } from './errors';
import { signInWithGoogle, type SignInResult } from './googleAuth';
import { loginEmailSchema } from './schema';

type ErrosEmail = Partial<Record<'email' | 'senha', string>>;

export type LoginViewProps = {
  // Prop só para os testes ligarem o formulário; no app o valor vem do .env (ver emailAuth.ts).
  mostrarLoginEmail?: boolean;
};

export function LoginView({ mostrarLoginEmail = loginEmailHabilitado }: LoginViewProps) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [errosEmail, setErrosEmail] = useState<ErrosEmail>({});

  // Um login por vez: enquanto um está em andamento, o outro botão fica desabilitado.
  const entrando = loadingGoogle || loadingEmail;

  // Em caso de sucesso não fazemos nada aqui: a sessão nova dispara o redirect no layout raiz,
  // e o botão continua em loading até a Home aparecer (evita "piscar" o botão habilitado).
  function tratarFalha(result: SignInResult, pararLoading: () => void) {
    if (!result.ok) {
      setErrorMessage(authErrorMessage(result.code));
      pararLoading();
    }
  }

  async function handleGooglePress() {
    setLoadingGoogle(true);
    setErrorMessage(null);

    const result = await signInWithGoogle();
    tratarFalha(result, () => setLoadingGoogle(false));
  }

  async function handleEmailPress() {
    setErrorMessage(null);

    const validacao = loginEmailSchema.safeParse({ email, senha });
    if (!validacao.success) {
      const fieldErrors = z.flattenError(validacao.error).fieldErrors;
      setErrosEmail({ email: fieldErrors.email?.[0], senha: fieldErrors.senha?.[0] });
      return;
    }
    setErrosEmail({});

    setLoadingEmail(true);
    const result = await signInWithEmail(validacao.data.email, validacao.data.senha);
    tratarFalha(result, () => setLoadingEmail(false));
  }

  return (
    <Screen>
      {/* A mesma marca do ícone e da splash, no topo e centralizada: quem abre o app reconhece onde
          está (EIX-11). */}
      <Logo withWordmark />

      {/* O login fica no centro do espaço que sobra abaixo da marca. */}
      <View style={styles.conteudo}>
        <Column gap="sm">
          <Text variant="display">Entre para continuar</Text>
          <Text tone="body">Use sua conta Google para acessar a gestão financeira e a frota da empresa.</Text>
        </Column>

        <Button
          label="Continuar com Google"
          onPress={handleGooglePress}
          loading={loadingGoogle}
          disabled={loadingEmail}
          variant="google"
        />

        {mostrarLoginEmail && (
          <Column gap="md">
            <Text variant="bodySm" tone="muted">
              Ou entre com uma conta de teste
            </Text>
            <Input
              label="E-mail"
              placeholder="voce@empresa.com"
              value={email}
              onChangeText={setEmail}
              error={errosEmail.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={!entrando}
            />
            <Input
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              error={errosEmail.senha}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!entrando}
            />
            <Button
              label="Entrar com e-mail"
              onPress={handleEmailPress}
              loading={loadingEmail}
              disabled={loadingGoogle}
              variant="ghost"
            />
          </Column>
        )}

        {errorMessage && (
          // role "alert" faz o leitor de tela anunciar o erro assim que ele aparece.
          <Text accessibilityRole="alert" variant="bodySm">
            {errorMessage}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Ocupa a altura abaixo da marca e centraliza o login nela, com o mesmo gap do Screen.
  conteudo: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
