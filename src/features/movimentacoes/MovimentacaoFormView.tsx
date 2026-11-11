import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { z } from 'zod';

import { rotuloTipoCategoria, type TipoCategoria } from '@/features/categorias/types';
import {
  buscarViagemVinculavel,
  descricaoViagem,
  listarViagensVinculaveis,
  rotuloViagem,
  type ViagemVinculavel,
} from '@/features/ponte-viagem/ponteRepository';
import { isoParaDataBR } from '@/lib/datas';
import { removerComprovante } from '@/lib/storage';
import { Button, CampoData, CampoMoeda, Column, EmptyState, Input, Screen, Select, Snackbar, Tabs, Text, colors } from '@/ui';

import { camposMovimentacao, type CampoMovimentacao, type ContextoCampos } from './camposMovimentacao';
import { AnexoComprovante } from './components/AnexoComprovante';
import {
  atualizarMovimentacao,
  buscarMovimentacaoPorId,
  criarMovimentacao,
  listarOpcoesMovimentacao,
  type OpcoesMovimentacao,
} from './movimentacoesRepository';
import { movimentacaoSchema, type MovimentacaoFormValues } from './schema';
import { rotuloStatus, type Movimentacao, type StatusPagamento } from './types';

type Erros = Partial<Record<keyof MovimentacaoFormValues, string>>;
type Feedback = { mensagem: string; tone: 'success' | 'error' };
type StatusCarga = 'carregando' | 'pronto' | 'erro';

const VALORES_INICIAIS: MovimentacaoFormValues = {
  valorCentavos: 0,
  descricao: '',
  categoriaId: null,
  formaPagamentoId: null,
  dataVencimento: '',
  status: 'Pendente',
  caminhoComprovante: null,
  dataPagamento: '',
  viagemId: null,
  litros: '',
};

function valoresDe(movimentacao: Movimentacao): MovimentacaoFormValues {
  return {
    valorCentavos: movimentacao.valorCentavos,
    descricao: movimentacao.descricao,
    categoriaId: movimentacao.categoria_id,
    formaPagamentoId: movimentacao.forma_pagamento_id,
    dataVencimento: movimentacao.data_vencimento ? isoParaDataBR(movimentacao.data_vencimento) : '',
    status: movimentacao.status_pagamento,
    caminhoComprovante: movimentacao.caminho_comprovante,
    dataPagamento: movimentacao.data_pagamento ? isoParaDataBR(movimentacao.data_pagamento) : '',
    viagemId: movimentacao.viagem_id,
    // Vírgula decimal, como o usuário digita.
    litros: movimentacao.litros === null ? '' : String(movimentacao.litros).replace('.', ','),
  };
}

// Combustível é achado pelo título, como no banco (trigger `valida_litros_movimentacao`).
function ehCombustivel(categoria: { titulo: string; tipo: TipoCategoria } | undefined): boolean {
  return categoria?.titulo === 'Combustível' && categoria.tipo === 'Saida';
}

// Usado quando a viagem do vínculo não carrega: o campo não fica parecendo vazio.
const ROTULO_VIAGEM_DESCONHECIDA = 'Viagem vinculada';

export type MovimentacaoFormViewProps = {
  movimentacaoId?: string;
  // Lançamento novo já vinculado: vem do "Nova movimentação" do detalhe da viagem (PONTE-08).
  viagemIdInicial?: string;
};

export function MovimentacaoFormView({ movimentacaoId, viagemIdInicial }: MovimentacaoFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!movimentacaoId;

  const [status, setStatus] = useState<StatusCarga>('carregando');
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesMovimentacao>({ categorias: [], formasPagamento: [] });
  // Lançamento original na edição: guarda nomes de categoria/forma que podem estar inativas.
  const [original, setOriginal] = useState<Movimentacao | null>(null);
  // Viagens que o seletor lista (US09) e o rótulo de uma viagem vinculada que está fora da lista.
  const [viagens, setViagens] = useState<ViagemVinculavel[]>([]);
  const [rotuloViagemFora, setRotuloViagemFora] = useState<string | undefined>(undefined);
  const [valores, setValores] = useState<MovimentacaoFormValues>(() => ({
    ...VALORES_INICIAIS,
    viagemId: viagemIdInicial ?? null,
  }));
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      const [resultadoOpcoes, resultadoMovimentacao, resultadoViagens] = await Promise.all([
        listarOpcoesMovimentacao(),
        movimentacaoId ? buscarMovimentacaoPorId(movimentacaoId) : Promise.resolve(null),
        listarViagensVinculaveis(),
      ]);
      if (cancelado) return;

      const falha = !resultadoOpcoes.ok
        ? resultadoOpcoes
        : resultadoMovimentacao && !resultadoMovimentacao.ok
          ? resultadoMovimentacao
          : !resultadoViagens.ok
            ? resultadoViagens
            : null;
      if (falha) {
        setErroCarga(falha.mensagem);
        setStatus('erro');
        return;
      }

      if (resultadoOpcoes.ok) setOpcoes(resultadoOpcoes.data);
      const listaViagens = resultadoViagens.ok ? resultadoViagens.data : [];
      setViagens(listaViagens);

      let viagemId = viagemIdInicial ?? null;
      if (resultadoMovimentacao?.ok) {
        setOriginal(resultadoMovimentacao.data);
        setValores(valoresDe(resultadoMovimentacao.data));
        viagemId = resultadoMovimentacao.data.viagem_id;
      }

      // Vínculo com uma viagem antiga (concluída há mais de 30 dias, cancelada): ela não está na
      // lista, mas o campo continua mostrando qual é (PONTE-07).
      if (viagemId && !listaViagens.some((viagem) => viagem.id === viagemId)) {
        const resultadoViagem = await buscarViagemVinculavel(viagemId);
        if (cancelado) return;
        setRotuloViagemFora(resultadoViagem.ok ? rotuloViagem(resultadoViagem.data) : ROTULO_VIAGEM_DESCONHECIDA);
      }
      setStatus('pronto');
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [movimentacaoId, viagemIdInicial]);

  function alterar<K extends keyof MovimentacaoFormValues>(nome: K, valor: MovimentacaoFormValues[K]) {
    setValores((atuais) => ({ ...atuais, [nome]: valor }));
  }

  // Um anexo enviado nesta tela e trocado ou removido antes de salvar não está em nenhuma
  // movimentação: apaga já, para não sobrar arquivo no bucket. O anexo que já estava gravado só
  // é apagado depois que a movimentação for salva sem ele (ver handleSalvar).
  function trocarComprovante(caminho: string | null) {
    const anterior = valores.caminhoComprovante;
    if (anterior && anterior !== original?.caminho_comprovante) removerComprovante(anterior);
    alterar('caminhoComprovante', caminho);
  }

  // Tipo da categoria escolhida decide "Pago" x "Recebido". Sem categoria, vale o de saída.
  const tipoAtual: TipoCategoria =
    opcoes.categorias.find((categoria) => categoria.id === valores.categoriaId)?.tipo ??
    (original && original.categoria_id === valores.categoriaId ? original.categoria.tipo : 'Saida');

  // Combustível decide se o campo de litros aparece e se ele é validado (LITROS-01/02).
  const contexto: ContextoCampos = {
    combustivel: ehCombustivel(
      opcoes.categorias.find((categoria) => categoria.id === valores.categoriaId) ??
        (original && original.categoria_id === valores.categoriaId ? original.categoria : undefined),
    ),
  };

  async function handleSalvar() {
    if (salvando) return;

    const resultado = movimentacaoSchema.safeParse({ ...valores, combustivel: contexto.combustivel });
    if (!resultado.success) {
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      const novosErros: Erros = {};
      for (const campo of camposMovimentacao) {
        novosErros[campo.nome] = fieldErrors[campo.nome]?.[0];
      }
      setErros(novosErros);
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = movimentacaoId
      ? await atualizarMovimentacao(movimentacaoId, resultado.data)
      : await criarMovimentacao(resultado.data);

    if (!resposta.ok) {
      setSalvando(false);
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    // A movimentação já não aponta para o anexo antigo, então o arquivo pode sair do bucket (AC:
    // remover apaga do Storage). Se falhar, sobra um arquivo sem uso, mas o lançamento está salvo
    // e certo: não vale mostrar erro para isso.
    const anexoAntigo = original?.caminho_comprovante;
    if (anexoAntigo && anexoAntigo !== resultado.data.caminhoComprovante) await removerComprovante(anexoAntigo);
    setSalvando(false);

    setFeedback({ mensagem: modoEdicao ? 'Movimentação atualizada.' : 'Movimentação registrada.', tone: 'success' });
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  function renderizarCampo(campo: CampoMovimentacao) {
    const erro = erros[campo.nome];

    switch (campo.tipo) {
      case 'moeda':
        return (
          <CampoMoeda
            key={campo.nome}
            label={campo.rotulo}
            valorCentavos={valores.valorCentavos}
            onChange={(centavos) => alterar('valorCentavos', centavos)}
            error={erro}
          />
        );
      case 'texto':
        return (
          <Input
            key={campo.nome}
            label={campo.rotulo}
            placeholder={campo.placeholder}
            value={valores.descricao}
            onChangeText={(texto) => alterar('descricao', texto)}
            maxLength={120}
            error={erro}
          />
        );
      case 'categoria':
        return (
          <Select
            key={campo.nome}
            label={campo.rotulo}
            value={valores.categoriaId}
            options={opcoes.categorias.map((categoria) => ({
              value: categoria.id,
              label: categoria.titulo,
              description: rotuloTipoCategoria[categoria.tipo],
            }))}
            onChange={(id) => alterar('categoriaId', id)}
            placeholder="Escolha a categoria"
            emptyMessage="Nenhuma opção cadastrada."
            fallbackLabel={original?.categoria.titulo}
            error={erro}
          />
        );
      case 'formaPagamento':
        return (
          <Select
            key={campo.nome}
            label={campo.rotulo}
            value={valores.formaPagamentoId}
            options={opcoes.formasPagamento.map((forma) => ({ value: forma.id, label: forma.nome }))}
            onChange={(id) => alterar('formaPagamentoId', id)}
            placeholder="Escolha a forma de pagamento"
            emptyMessage="Nenhuma opção cadastrada."
            fallbackLabel={original?.formaPagamento.nome}
            error={erro}
          />
        );
      case 'viagem':
        return (
          <Select
            key={campo.nome}
            label={campo.rotulo}
            value={valores.viagemId}
            options={viagens.map((viagem) => ({
              value: viagem.id,
              label: rotuloViagem(viagem),
              description: descricaoViagem(viagem),
            }))}
            onChange={(id) => alterar('viagemId', id)}
            searchable
            clearLabel="Sem viagem"
            onClear={() => alterar('viagemId', null)}
            emptyMessage="Nenhuma viagem em andamento ou concluída nos últimos 30 dias."
            noResultsMessage="Nenhuma viagem encontrada."
            fallbackLabel={rotuloViagemFora}
            error={erro}
          />
        );
      case 'litros':
        return (
          <Input
            key={campo.nome}
            label={campo.rotulo}
            placeholder={campo.placeholder}
            value={valores.litros}
            onChangeText={(texto) => alterar('litros', texto)}
            keyboardType="decimal-pad"
            maxLength={9}
            error={erro}
          />
        );
      case 'data': {
        const nome = campo.nome === 'dataPagamento' ? 'dataPagamento' : 'dataVencimento';
        const rotulo = nome === 'dataPagamento' && tipoAtual === 'Entrada' ? 'Data de recebimento' : campo.rotulo;
        return (
          <CampoData
            key={campo.nome}
            label={rotulo}
            value={valores[nome]}
            onChange={(texto) => alterar(nome, texto)}
            error={erro}
          />
        );
      }
      case 'status':
        return (
          <Column key={campo.nome} gap="xs">
            <Text variant="bodySm" tone="body" weight="medium">
              {campo.rotulo}
            </Text>
            <Tabs
              accessibilityLabel={campo.rotulo}
              options={(['Pendente', 'Pago'] as const).map((opcao) => ({
                value: opcao,
                label: rotuloStatus(opcao, tipoAtual),
              }))}
              value={valores.status}
              onChange={(opcao) => alterar('status', opcao as StatusPagamento)}
            />
          </Column>
        );
      case 'anexo':
        return (
          <AnexoComprovante
            key={campo.nome}
            label={campo.rotulo}
            value={valores.caminhoComprovante}
            onChange={trocarComprovante}
            onErro={(mensagem) => setFeedback({ mensagem, tone: 'error' })}
            error={erro}
          />
        );
    }
  }

  if (status === 'carregando') {
    return (
      <Screen align="center" underHeader>
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel="Carregando formulário" />
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState title={erroCarga ?? 'Não foi possível carregar.'} actionLabel="Voltar" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    // Formulário longo: o Screen rola em celular pequeno (RNF02) e sobe com o teclado.
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
        {camposMovimentacao
          .filter((campo) => !campo.visivel || campo.visivel(valores, contexto))
          .map(renderizarCampo)}
      </Column>

      <Button label="Salvar" onPress={handleSalvar} loading={salvando} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
