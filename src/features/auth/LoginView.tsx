import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, Column, Input, Logo, MensagemErro, Text, colors, layout, radius, spacing, useTablet } from '@/ui';

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
  const { height: altura } = useWindowDimensions();
  const tablet = useTablet();

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
    <View style={styles.tela}>
      {/* Ícones da barra de status claros sobre a foto. Ao sair do Login, a barra volta ao escuro do
          layout raiz. */}
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.rolagem}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Foto decorativa: o leitor de tela pula direto para a marca e o login. */}
          <Image
            source={FOTO}
            resizeMode="cover"
            accessible={false}
            accessibilityIgnoresInvertColors
            testID="login-foto"
            style={{ height: Math.round(altura * FRACAO_DA_FOTO) }}
          />

          {/* A folha sobe sobre a foto com os cantos de cima arredondados (referência 4 do redesign).
              O SafeAreaView soma ao respiro de baixo a área do gesto de navegação. */}
          <SafeAreaView edges={['bottom']} style={styles.folha}>
            <View style={[styles.conteudo, tablet && styles.coluna]}>
              <Logo withWordmark compacto />

              <Column gap="sm">
                <Text variant="display">Bem-vindo de volta</Text>
                <Text tone="body">Caixa, frota e viagens da transportadora num lugar só.</Text>
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
                  <View style={styles.divisor}>
                    <View style={styles.linha} />
                    <Text variant="caption" tone="body">
                      ou com e-mail de teste
                    </Text>
                    <View style={styles.linha} />
                  </View>
                  <Input
                    label="E-mail"
                    icone="email"
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
                    icone="senha"
                    value={senha}
                    onChangeText={setSenha}
                    error={errosEmail.senha}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                    editable={!entrando}
                  />
                  {/* "Entrar" na tela, como no protótipo; o leitor de tela ouve qual dos dois logins é. */}
                  <Button
                    label="Entrar"
                    accessibilityLabel="Entrar com e-mail"
                    onPress={handleEmailPress}
                    loading={loadingEmail}
                    disabled={loadingGoogle}
                  />
                </Column>
              )}

              {errorMessage && (
                // A MensagemErro tem role "alert": o leitor de tela anuncia o erro assim que ele aparece.
                <MensagemErro>{errorMessage}</MensagemErro>
              )}
            </View>
          </SafeAreaView>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Foto do topo: um caminhão na estrada, recortado do protótipo do Figma (direção A).
const FOTO = require('../../../assets/images/login-caminhao.jpg');

// A foto ocupa ~40% da altura, como no protótipo (360 de 844); a folha cobre o resto.
const FRACAO_DA_FOTO = 0.42;

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  // A folha cresce até o fim da tela, mesmo quando o conteúdo é curto (login só com Google).
  rolagem: {
    flexGrow: 1,
  },
  folha: {
    flexGrow: 1,
    // Sobe 48pt sobre a foto: o canto arredondado aparece por cima dela.
    marginTop: -spacing.xxl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  conteudo: {
    gap: spacing.lg,
  },
  // No tablet o formulário fica numa coluna legível, centralizado na folha (RNF02).
  coluna: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  // "ou com e-mail de teste" entre duas linhas finas: separa o login principal do de teste.
  divisor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  linha: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
