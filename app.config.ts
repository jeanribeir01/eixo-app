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
  plugins: ['expo-router', 'expo-status-bar'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
