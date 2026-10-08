import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Mesmo formato que os repositórios já devolvem.
export type Resultado<T> = { ok: true; data: T } | { ok: false; mensagem: string };

export type StatusDaTela = 'carregando' | 'pronto' | 'erro';

export type DadosDaTela<T> = {
  status: StatusDaTela;
  dados: T | null;
  // Erro da primeira carga: a tela mostra o estado de erro com "Tentar novamente".
  erro: string | null;
  // Pull-to-refresh em andamento (o indicador nativo do RefreshControl).
  atualizando: boolean;
  // Erro numa recarga com dados já na tela: vira Snackbar, sem apagar a lista.
  feedbackErro: string | null;
  limparFeedbackErro: () => void;
  // "Tentar novamente" do estado de erro.
  recarregar: () => void;
  puxarParaAtualizar: () => Promise<void>;
  // Ajuste local depois de uma ação que já deu certo no banco (ex.: switch de ativa, exclusão).
  atualizarDados: (alterar: (atuais: T) => T) => void;
};

// Carga das telas de lista (EIX-63): junta num lugar só os padrões que cada lista copiava à mão.
// - Carrega ao abrir e recarrega sempre que a tela volta ao foco (quem volta de uma edição vê a mudança).
// - Skeleton só na primeira carga. Na recarga, os dados atuais ficam na tela até os novos chegarem:
//   a lista não pisca.
// - Só a resposta mais recente escreve na tela; uma resposta lenta e antiga é descartada.
// - `buscar` deve vir de um useCallback. Quando ele muda (outro mês em Movimentações, por exemplo),
//   é outra consulta: a tela volta ao skeleton em vez de mostrar dados do mês anterior.
export function useDadosDaTela<T>(buscar: () => Promise<Resultado<T>>): DadosDaTela<T> {
  const [status, setStatus] = useState<StatusDaTela>('carregando');
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [feedbackErro, setFeedbackErro] = useState<string | null>(null);
  // Cada carga ganha um número; só a mais recente pode escrever na tela.
  const ultimoPedido = useRef(0);
  // Qual consulta gerou os dados que estão na tela.
  const consultaNaTela = useRef<typeof buscar | null>(null);

  const carregar = useCallback(async () => {
    const pedido = ++ultimoPedido.current;
    const temDadosDestaConsulta = consultaNaTela.current === buscar;
    if (!temDadosDestaConsulta) {
      setStatus('carregando');
      setDados(null);
    }

    const resultado = await buscar();
    if (pedido !== ultimoPedido.current) return;

    if (resultado.ok) {
      consultaNaTela.current = buscar;
      setDados(resultado.data);
      setErro(null);
      setStatus('pronto');
    } else if (temDadosDestaConsulta) {
      setFeedbackErro(resultado.mensagem);
    } else {
      setErro(resultado.mensagem);
      setStatus('erro');
    }
  }, [buscar]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const puxarParaAtualizar = useCallback(async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }, [carregar]);

  const atualizarDados = useCallback((alterar: (atuais: T) => T) => {
    setDados((atuais) => (atuais === null ? atuais : alterar(atuais)));
  }, []);

  return {
    status,
    dados,
    erro,
    atualizando,
    feedbackErro,
    limparFeedbackErro: () => setFeedbackErro(null),
    recarregar: () => {
      carregar();
    },
    puxarParaAtualizar,
    atualizarDados,
  };
}
