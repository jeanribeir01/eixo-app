// O Metro precisa reconhecer .sql como código-fonte para resolver os imports das
// migrations do Drizzle (src/db/migrations/migrations.js); o babel.config.js converte o conteúdo.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

module.exports = config;
