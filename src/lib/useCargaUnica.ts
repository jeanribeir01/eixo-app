import { useCallback, useEffect, useRef, useState } from 'react';

import { MENSAGEM_SEM_INTERNET, useConexaoStore, useOnline } from './conexao';
import type { Resultado, StatusDaTela } from './useDadosDaTela';

export type CargaUnica = {
  status: StatusDaTela;
  // Mensagem da carga que falhou ("Sem internet…" quando é a conexão).
  erro: string | null;
  tentarDeNovo: () => void;
};

// Carga que acontece uma vez só: formulário de edição e detalhe que não recarrega no foco. Recarregar
// o formulário ao voltar para ele apagaria o que a pessoa já digitou; por isso não é o useDadosDaTela.
// A regra de internet é a mesma dele:
// - Sem internet, não consulta (a consulta pode ficar pendurada) e mostra o erro "Sem internet" na hora.
// - A internet caiu no meio da carga: sai do "carregando" para o erro.
// - A conexão voltou com a carga em erro: tenta de novo sozinha. Com a carga pronta, não mexe em nada.
//
// `buscar` deve vir de um useCallback (ou ser null, quando não há o que carregar, como no "Novo").
// `aoCarregar` recebe os dados para a tela preencher os campos.
export function useCargaUnica<T>(
  buscar: (() => Promise<Resultado<T>>) | null,
  aoCarregar: (dados: T) => void,
): CargaUnica {
  const [status, setStatus] = useState<StatusDaTela>(buscar ? 'carregando' : 'pronto');
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const online = useOnline();

  // Lidos dentro dos efeitos sem entrar nas dependências: trocar a função de preencher a tela ou o
  // status não deve disparar outra carga.
  const aoCarregarRef = useRef(aoCarregar);
  const statusRef = useRef(status);
  useEffect(() => {
    aoCarregarRef.current = aoCarregar;
    statusRef.current = status;
  });

  useEffect(() => {
    if (!buscar) return;
    let cancelado = false;

    async function carregar() {
      if (!useConexaoStore.getState().online) {
        setErro(MENSAGEM_SEM_INTERNET);
        setStatus('erro');
        return;
      }
      setStatus('carregando');
      const resultado = await buscar!();
      if (cancelado) return;
      if (!resultado.ok) {
        setErro(resultado.mensagem);
        setStatus('erro');
        return;
      }
      aoCarregarRef.current(resultado.data);
      setErro(null);
      setStatus('pronto');
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [buscar, tentativa]);

  // Volta da conexão: só repete a carga que não deu certo.
  useEffect(
    () =>
      useConexaoStore.subscribe((agora, antes) => {
        if (agora.online && !antes.online && statusRef.current !== 'pronto') setTentativa((atual) => atual + 1);
      }),
    [],
  );

  const tentarDeNovo = useCallback(() => setTentativa((atual) => atual + 1), []);
  const presaCarregando = !online && status === 'carregando';

  return {
    status: presaCarregando ? 'erro' : status,
    erro: presaCarregando ? MENSAGEM_SEM_INTERNET : erro,
    tentarDeNovo,
  };
}
