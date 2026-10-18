import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { Button, Column, EmptyState, Input, Screen, Select, Snackbar, Text, colors } from '@/ui';
import { Constants } from '@/types/database';

import { atualizarRota, buscarRotaPorId, criarRota, definirAtivaRota } from './rotasRepository';
import { rotaSchema } from './schema';
import type { Uf } from './types';

type Campo = 'cidade_origem' | 'uf_origem' | 'cidade_destino' | 'uf_destino' | 'distancia_estimada_km';
type Erros = Partial<Record<Campo, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';
// Rota igual já cadastrada: a mensagem fica no formulário e, se ela estiver inativa, o id vai
// para o botão "Reativar rota existente".
type Duplicada = { mensagem: string; rotaInativaId?: string };

// As 27 UFs do enum `uf` gerado, na ordem do banco: sem lista escrita à mão nem texto livre (ROTA-02).
const opcoesUf = Constants.public.Enums.uf.map((sigla) => ({ value: sigla, label: sigla }));

// O número vem do banco com ponto; na tela o usuário lê e digita com vírgula.
function distanciaParaTexto(km: number): string {
  return String(km).replace('.', ',');
}

export type RotaFormViewProps = {
  // Sem id é cadastro (`/rotas/nova`); com id é edição (`/rotas/[id]/editar`), como em CategoriaFormView.
  rotaId?: string;
};

export function RotaFormView({ rotaId }: RotaFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!rotaId;

  const [status, setStatus] = useState<StatusCarga>(modoEdicao ? 'carregando' : 'pronto');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [cidadeOrigem, setCidadeOrigem] = useState('');
  // UF começa sem escolha: o usuário precisa escolher, e o schema avisa se não escolheu (ROTA-07).
  const [ufOrigem, setUfOrigem] = useState<Uf | null>(null);
  const [cidadeDestino, setCidadeDestino] = useState('');
  const [ufDestino, setUfDestino] = useState<Uf | null>(null);
  const [distancia, setDistancia] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [duplicada, setDuplicada] = useState<Duplicada | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [reativando, setReativando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!rotaId) return;
    const id = rotaId;
    let cancelado = false;

    async function carregar() {
      setStatus('carregando');
      const resultado = await buscarRotaPorId(id);
      if (cancelado) return;

      if (!resultado.ok) {
        setErroCarga(resultado.mensagem);
        setStatus('erro');
        return;
      }

      setCidadeOrigem(resultado.data.cidade_origem);
      setUfOrigem(resultado.data.uf_origem);
      setCidadeDestino(resultado.data.cidade_destino);
      setUfDestino(resultado.data.uf_destino);
      setDistancia(distanciaParaTexto(resultado.data.distancia_estimada_km));
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [rotaId]);

  // Mudou o trecho: o aviso de duplicada era do trecho anterior. Some, para o botão de reativar
  // não apontar para uma rota que já não é a que está digitada.
  function alterarTrecho<T>(setter: (valor: T) => void) {
    return (valor: T) => {
      setter(valor);
      setDuplicada(null);
    };
  }

  async function handleSalvar() {
    const resultado = rotaSchema.safeParse({
      cidade_origem: cidadeOrigem,
      uf_origem: ufOrigem ?? undefined,
      cidade_destino: cidadeDestino,
      uf_destino: ufDestino ?? undefined,
      distancia_estimada_km: distancia,
    });
    if (!resultado.success) {
      // Um erro por campo: a mensagem aparece junto do campo que falhou.
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({
        cidade_origem: fieldErrors.cidade_origem?.[0],
        uf_origem: fieldErrors.uf_origem?.[0],
        cidade_destino: fieldErrors.cidade_destino?.[0],
        uf_destino: fieldErrors.uf_destino?.[0],
        distancia_estimada_km: fieldErrors.distancia_estimada_km?.[0],
      });
      return;
    }
    setErros({});
    setDuplicada(null);

    setSalvando(true);
    const resposta = rotaId ? await atualizarRota(rotaId, resultado.data) : await criarRota(resultado.data);
    setSalvando(false);

    if (!resposta.ok) {
      // Rota duplicada é uma validação, não um erro de rede: fica no formulário também.
      if (resposta.campo === 'trecho') {
        setDuplicada({ mensagem: resposta.mensagem, rotaInativaId: resposta.rotaInativaId });
      }
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setFeedback({ mensagem: rotaId ? 'Rota atualizada.' : 'Rota cadastrada.', tone: 'success' });
  }

  // Só marca a rota existente como ativa; não grava a distância digitada (decisão da spec).
  async function handleReativar(id: string) {
    setReativando(true);
    const resposta = await definirAtivaRota(id, true);
    setReativando(false);

    if (!resposta.ok) {
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setDuplicada(null);
    setFeedback({ mensagem: 'Rota reativada.', tone: 'success' });
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  if (status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando rota" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState
          title="Não foi possível carregar a rota"
          description={erroCarga ?? undefined}
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const rotaInativaId = duplicada?.rotaInativaId;

  return (
    <Screen
      underHeader
      scroll
      overlay={
        feedback && (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} duration={1200} onDismiss={handleFeedbackDismiss} />
        )
      }
    >
      <Column gap="md">
        <Input
          label="Cidade de origem"
          placeholder="Ex.: Curitiba"
          value={cidadeOrigem}
          onChangeText={alterarTrecho(setCidadeOrigem)}
          error={erros.cidade_origem}
        />
        <Select
          label="UF de origem"
          value={ufOrigem}
          options={opcoesUf}
          onChange={alterarTrecho((valor: string) => setUfOrigem(valor as Uf))}
          error={erros.uf_origem}
        />
        <Input
          label="Cidade de destino"
          placeholder="Ex.: São Paulo"
          value={cidadeDestino}
          onChangeText={alterarTrecho(setCidadeDestino)}
          error={erros.cidade_destino}
        />
        <Select
          label="UF de destino"
          value={ufDestino}
          options={opcoesUf}
          onChange={alterarTrecho((valor: string) => setUfDestino(valor as Uf))}
          error={erros.uf_destino}
        />
        <Input
          label="Distância estimada (km)"
          placeholder="Ex.: 408,5"
          value={distancia}
          onChangeText={setDistancia}
          keyboardType="decimal-pad"
          error={erros.distancia_estimada_km}
        />

        {duplicada && (
          <Column gap="sm">
            <Text accessibilityRole="alert" variant="bodySm">
              {duplicada.mensagem}
            </Text>
            {/* Ghost: o único cyan da tela é o "Salvar" (DESIGN_CYAN §7). */}
            {rotaInativaId && (
              <Button
                label="Reativar rota existente"
                variant="ghost"
                onPress={() => handleReativar(rotaInativaId)}
                loading={reativando}
                disabled={salvando}
              />
            )}
          </Column>
        )}
      </Column>

      <Button label="Salvar" onPress={handleSalvar} loading={salvando} disabled={reativando} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
