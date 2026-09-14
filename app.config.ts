import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Eixo Certo',
  slug: 'eixo-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'eixocerto',
  userInterfaceStyle: 'light',
  android: {
    // O client OAuth Android do Google Cloud é registrado com este package + SHA-1.
    // Mudar o package quebra o login até registrar um novo client.
    package: 'com.eixocerto.app',
    adaptiveIcon: {
      backgroundColor: '#fafaf9',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    // Exclui os dados do SecureStore do backup automático do Android: uma sessão restaurada em outro
    // aparelho não conseguiria ser lida (a chave de criptografia fica no Keystore do aparelho original).
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#fafaf9', // tokens.colors.canvas
      },
    ],
    // O plugin '@react-native-google-signin/google-signin' NÃO entra aqui de propósito:
    // sem opções ele configura o Firebase (exige google-services.json) e com opções só mexe no iOS.
    // No Android sem Firebase, o autolinking já instala o módulo nativo. Ao adicionar iOS, inclua:
    // ['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.<ID>' }]
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
