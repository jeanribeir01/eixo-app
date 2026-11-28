import { Aviso } from './Aviso';

export type AvisoSemInternetProps = {
  // Hora da última carga ("14:32"): diz de quando são os dados que continuam na tela.
  carregadoAs?: string | null;
};

// O mesmo aviso em toda tela que precisa de internet (DESIGN-CYAN 2.0, estados): os dados ficam na
// tela, e o texto diz que são de antes e que a tela se atualiza sozinha. Fica no topo do conteúdo,
// como o "Sem internet" da lista de Viagens.
export function AvisoSemInternet({ carregadoAs }: AvisoSemInternetProps) {
  return (
    <Aviso tom="warning" icone="semInternet" titulo="Sem internet">
      {carregadoAs
        ? `Mostrando o que foi carregado às ${carregadoAs}. A tela se atualiza sozinha quando a conexão voltar.`
        : 'A tela se atualiza sozinha quando a conexão voltar.'}
    </Aviso>
  );
}
