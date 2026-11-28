// Como o app escreve uma rota, num lugar só.
//
// O trecho é só "Curitiba → São Paulo", sem UF. "Curitiba/PR" quebrava a linha logo depois da barra
// no Android ("Belo Horizonte/ ↵ MG") e espremia o nome da cidade nas linhas de lista. A UF só
// aparece onde ela separa duas rotas de mesmo nome (cadastro de Rotas, escolha da rota ao abrir a
// viagem), e vai no subtítulo, por `ufsDoTrecho`.

type Cidades = { cidade_origem: string; cidade_destino: string };
type Ufs = { uf_origem: string; uf_destino: string };

export function trecho(rota: Cidades): string {
  return `${rota.cidade_origem} → ${rota.cidade_destino}`;
}

// "PR → SP", para o subtítulo.
export function ufsDoTrecho(rota: Ufs): string {
  return `${rota.uf_origem} → ${rota.uf_destino}`;
}

// Viagem sem rota (rota apagada ou não informada na abertura).
export const SEM_ROTA = 'Rota não informada';

export function trechoDaViagem(viagem: { rota?: Cidades | null }): string {
  return viagem.rota ? trecho(viagem.rota) : SEM_ROTA;
}
