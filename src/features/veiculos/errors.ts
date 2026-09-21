// Erros de domínio do módulo de frota. A tela nunca mostra o erro cru do repositório/banco:
// captura estes tipos e exibe a mensagem já pronta no campo correspondente.
export class PlacaDuplicadaError extends Error {
  constructor(placa: string) {
    super(`Já existe um veículo cadastrado com a placa ${placa}.`);
    this.name = 'PlacaDuplicadaError';
  }
}

export class VeiculoNaoEncontradoError extends Error {
  constructor(id: string) {
    super(`Veículo não encontrado (${id}).`);
    this.name = 'VeiculoNaoEncontradoError';
  }
}
