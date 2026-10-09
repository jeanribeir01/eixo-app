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
    // Ícone da marca (EIX-11): marca branca sobre o azul, igual ao icon.png. O foreground deixa a marca
    // dentro do círculo central que todo launcher mostra, qualquer que seja a máscara do aparelho.
    adaptiveIcon: {
      backgroundColor: '#3398e1', // tokens.colors.accentEdge
      foregroundImage: './assets/android-icon-foreground.png',
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
        // Marca azul sem margem. No Android 12+ a splash recorta o que passa de um círculo de 192dp:
        // a 144dp, a roda mais distante fica a ~89dp do centro, dentro do raio de 96dp.
        image: './assets/splash-icon.png',
        imageWidth: 144,
        resizeMode: 'contain',
        backgroundColor: '#fafaf9', // tokens.colors.canvas
      },
    ],
    // Comprovantes (US03-b): textos que o sistema mostra ao pedir a permissão. O comprovante é só
    // foto, então o microfone fica de fora (sem ele o Android não declara RECORD_AUDIO).
    [
      'expo-image-picker',
      {
        cameraPermission: 'O Eixo Certo usa a câmera para fotografar comprovantes de pagamento.',
        photosPermission: 'O Eixo Certo acessa suas fotos para anexar comprovantes de pagamento.',
        microphonePermission: false,
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
