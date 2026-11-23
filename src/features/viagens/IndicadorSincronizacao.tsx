import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Aviso, Column } from '@/ui';

import { useSyncStore } from './syncStore';

export type IndicadorSincronizacaoProps = {
  isOnline?: boolean;
  pendentes?: number;
  comErro?: number;
  /** Nome antigo mantido para os testes/chamadas que ainda passam `conflitos`. */
  conflitos?: number;
  emRevisao?: number;
  sincronizando?: boolean;
  atualizarAoMontar?: boolean;
};

// Quanto tempo o "Tudo enviado" fica na tela depois que a fila esvazia.
export const DURACAO_CONFIRMACAO_MS = 4000;

function registros(quantidade: number): string {
  return quantidade === 1 ? '1 registro' : `${quantidade} registros`;
}

// Estado do envio das viagens (offline-first, RNF01). Mostra uma situação por vez, a mais importante
// primeiro: enviando, sem internet, falha, envio pausado, aguardando. A revisão do gestor vem embaixo,
// porque não depende da internet. Quando a fila esvazia, confirma por alguns segundos que tudo subiu.
export function IndicadorSincronizacao({
  isOnline: isOnlineProp,
  pendentes: pendentesProp,
  comErro: comErroProp,
  conflitos: conflitosProp,
  emRevisao: emRevisaoProp,
  sincronizando: sincronizandoProp,
  atualizarAoMontar = true,
}: IndicadorSincronizacaoProps = {}) {
  const storeOnline = useSyncStore((state) => state.isOnline);
  const storePendentes = useSyncStore((state) => state.pendentes);
  const storeComErro = useSyncStore((state) => state.comErro);
  const storeEmRevisao = useSyncStore((state) => state.emRevisao);
  const storeSincronizando = useSyncStore((state) => state.sincronizando);
  const ultimoErro = useSyncStore((state) => state.ultimoErro);
  const atualizarStatus = useSyncStore((state) => state.atualizarStatus);
  const sincronizarTudo = useSyncStore((state) => state.sincronizarTudo);

  const isOnline = isOnlineProp ?? storeOnline;
  const pendentes = pendentesProp ?? storePendentes;
  const comErro = comErroProp ?? storeComErro;
  const emRevisao = emRevisaoProp ?? conflitosProp ?? storeEmRevisao;
  const sincronizando = sincronizandoProp ?? storeSincronizando;

  useEffect(() => {
    if (atualizarAoMontar && pendentesProp === undefined && isOnlineProp === undefined) {
      atualizarStatus();
    }
  }, [atualizarAoMontar, pendentesProp, isOnlineProp, atualizarStatus]);

  // "Tudo enviado": só na passagem de "tinha pendência" para "fila vazia", online e sem erro. Abrir a
  // tela com a fila já vazia não mostra nada.
  const [confirmando, setConfirmando] = useState(false);
  const pendentesAntes = useRef(pendentes);
  useEffect(() => {
    const esvaziou = pendentesAntes.current > 0 && pendentes === 0;
    pendentesAntes.current = pendentes;
    if (esvaziou && isOnline && comErro === 0 && !ultimoErro) setConfirmando(true);
  }, [pendentes, isOnline, comErro, ultimoErro]);

  // O timer depende só de "confirmando": outra mudança na tela não o cancela no meio.
  useEffect(() => {
    if (!confirmando) return;
    const timer = setTimeout(() => setConfirmando(false), DURACAO_CONFIRMACAO_MS);
    return () => clearTimeout(timer);
  }, [confirmando]);

  const principal = (() => {
    if (sincronizando) {
      return (
        <Aviso
          tom="info"
          emAndamento
          titulo={pendentes > 0 ? `Enviando ${registros(pendentes)}` : 'Atualizando suas viagens'}
        />
      );
    }
    if (!isOnline) {
      return (
        <Aviso
          tom="warning"
          icone="semInternet"
          titulo={pendentes > 0 ? `Sem internet · ${registros(pendentes)} aguardando envio` : 'Sem internet'}
        >
          {pendentes > 0
            ? 'Você pode continuar usando o app. O envio é automático quando a conexão voltar.'
            : 'O que você registrar fica guardado no aparelho e é enviado quando a conexão voltar.'}
        </Aviso>
      );
    }
    if (comErro > 0) {
      return (
        <Aviso
          tom="danger"
          icone="alerta"
          titulo={comErro === 1 ? '1 registro não foi enviado' : `${comErro} registros não foram enviados`}
          acao={{ label: 'Tentar enviar agora', onPress: () => void sincronizarTudo() }}
        >
          Nova tentativa automática em instantes.
        </Aviso>
      );
    }
    if (ultimoErro) {
      return (
        <Aviso
          tom="warning"
          icone="alerta"
          titulo="Envio pausado"
          acao={{ label: 'Tentar enviar agora', onPress: () => void sincronizarTudo() }}
        >
          {ultimoErro}
        </Aviso>
      );
    }
    if (pendentes > 0) {
      return (
        <Aviso tom="info" icone="enviando" titulo={`${registros(pendentes)} aguardando envio`}>
          O envio começa em instantes.
        </Aviso>
      );
    }
    if (confirmando) {
      return (
        <Aviso tom="success" icone="enviado" titulo="Tudo enviado">
          Seus registros já estão no servidor.
        </Aviso>
      );
    }
    return null;
  })();

  const revisao =
    emRevisao > 0 ? (
      <Aviso
        tom="info"
        icone="alerta"
        titulo={emRevisao === 1 ? '1 registro em revisão' : `${emRevisao} registros em revisão`}
      >
        O gestor vai conferir o que o servidor recusou. Seus dados continuam guardados no aparelho.
      </Aviso>
    ) : null;

  // Tudo em dia: não ocupa espaço na tela.
  if (!principal && !revisao) return null;

  return (
    <View testID="indicador-sincronizacao">
      <Column gap="sm">
        {principal}
        {revisao}
      </Column>
    </View>
  );
}
