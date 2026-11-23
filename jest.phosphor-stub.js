// Substituto dos ícones do Phosphor nos testes (moduleNameMapper em package.json). O ícone real desenha
// SVG com react-native-svg, o que não ajuda o teste a dizer qual ícone a tela pediu. Este troca cada
// ícone por um Text vazio que expõe o testID (`icone-<nome semântico>`, posto pelo Icon), o tamanho, a
// cor e o peso, como o mock antigo do expo-symbols fazia.
const { createElement } = require('react');
const { Text } = require('react-native');

function criarIcone(nome) {
  function IconeDeTeste({ testID, size, color, weight }) {
    return createElement(Text, { testID, weight, style: { width: size, height: size, color } });
  }
  IconeDeTeste.displayName = nome;
  return IconeDeTeste;
}

// Qualquer export pedido (`TruckIcon`, `PlusIcon`...) vira um ícone de teste com aquele nome.
module.exports = new Proxy({}, { get: (_alvo, chave) => (chave === '__esModule' ? true : criarIcone(String(chave))) });
