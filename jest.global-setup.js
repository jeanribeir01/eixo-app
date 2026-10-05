// Fuso fixo para todos os testes: o CI (ubuntu-latest) roda em UTC e as máquinas do time em
// Brasília. Com UTC, "data local" e "data UTC" coincidem e um erro de fuso passa despercebido.
// Precisa ser globalSetup: mudar process.env.TZ dentro de um teste não afeta o processo do Jest.
module.exports = () => {
  process.env.TZ = 'America/Sao_Paulo';
};
