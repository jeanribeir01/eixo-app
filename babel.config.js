// O migrations.js gerado pelo drizzle-kit faz `import m0000 from './0000_x.sql'`.
// O Metro não sabe ler .sql; o inline-import transforma cada arquivo em string no bundle.
// O preset oficial é o `babel-preset-expo`, declarado no package.json. O `expo/internal/babel-preset`
// é só um re-export interno do próprio expo e não é API pública, então não o usamos.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
