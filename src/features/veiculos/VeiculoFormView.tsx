import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useCargaUnica } from '@/lib/useCargaUnica';
import { Aviso, Button, Column, EmptyState, Input, Screen, Select, Skeleton, Snackbar, Text, spacing } from '@/ui';

import { formatarPlaca, normalizarPlaca } from './placa';
import { atualizarVeiculo, buscarVeiculoPorId, criarVeiculo, inativarVeiculo, reativarVeiculo } from './repository';
import { veiculoSchema } from './schema';
import { STATUS_VEICULO, rotuloStatusVeiculo, type StatusVeiculo } from './types';

type Campo = 'placa' | 'marca' | 'modelo' | 'ano_fabricacao' | 'capacidade_carga' | 'status';
type Erros = Partial<Record<Campo, string>>;
// `desfazer`: depois de desativar, o Snackbar oferece "Desfazer" (reativa na hora).
type Feedback = { mensagem: string; tone: 'success' | 'error'; desfazer?: boolean };
const opcoesStatus = STATUS_VEICULO.filter((status) => status !== 'Inativo').map((status) => ({ label: rotuloStatusVeiculo[status], value: status }));

// Placa tem 7 caracteres nos dois formatos; o hífen da antiga é o 8º, só visual.
const TAMANHO_PLACA = 7;

// Máscara enquanto digita: normaliza (maiúscula, sem hífen/espaço) e reaplica o hífen só quando a
// placa está completa no formato antigo (AAA-1234). Mercosul (AAA1A23) nunca leva hífen.
function mascararPlaca(texto: string): string {
  return formatarPlaca(normalizarPlaca(texto).slice(0, TAMANHO_PLACA));
}

// O número vem do banco com ponto; na tela o usuário lê e digita com vírgula.
function capacidadeParaTexto(toneladas: number): string {
  return String(toneladas).replace('.', ',');
}

export type VeiculoFormViewProps = {
  // Sem id: modo criar. Com id: modo editar, carrega o veículo antes de mostrar o formulário.
  veiculoId?: string;
};

export function VeiculoFormView({ veiculoId }: VeiculoFormViewProps) {
  const router = useRouter();
  const modoEdicao = !!veiculoId;

  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anoFabricacao, setAnoFabricacao] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [statusVeiculo, setStatusVeiculo] = useState<StatusVeiculo>('Disponivel');
  // O status gravado no banco, separado do seletor: desativar depende do que está salvo, não do que a
  // pessoa escolheu e ainda não salvou.
  const [statusSalvo, setStatusSalvo] = useState<StatusVeiculo>('Disponivel');
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [alterandoAtiva, setAlterandoAtiva] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // O "Desfazer" do Snackbar também fecha o Snackbar: sem esta marca, o fechamento voltaria para a lista
  // antes de a reativação terminar.
  const desfazendo = useRef(false);

  // Carga única no Editar (useCargaUnica): sem internet a tela diz isso na hora e tenta de novo sozinha
  // quando a conexão volta.
  const buscarVeiculo = useCallback(() => buscarVeiculoPorId(veiculoId!), [veiculoId]);
  const {
    status,
    erro: erroCarga,
    tentarDeNovo,
  } = useCargaUnica(veiculoId ? buscarVeiculo : null, (veiculo) => {
    setPlaca(formatarPlaca(veiculo.placa));
    setMarca(veiculo.marca);
    setModelo(veiculo.modelo);
    setAnoFabricacao(veiculo.ano_fabricacao === null ? '' : String(veiculo.ano_fabricacao));
    setCapacidade(capacidadeParaTexto(veiculo.capacidade_carga));
    setStatusVeiculo(veiculo.status);
    setStatusSalvo(veiculo.status);
  });

  async function handleSalvar() {
    if (salvando) return;
    const resultado = veiculoSchema.safeParse({
      placa,
      marca,
      modelo,
      ano_fabricacao: anoFabricacao,
      capacidade_carga: capacidade,
      status: statusVeiculo,
    });
    if (!resultado.success) {
      // Um erro por campo: a mensagem aparece junto do campo que falhou.
      const fieldErrors = z.flattenError(resultado.error).fieldErrors;
      setErros({
        placa: fieldErrors.placa?.[0],
        marca: fieldErrors.marca?.[0],
        modelo: fieldErrors.modelo?.[0],
        ano_fabricacao: fieldErrors.ano_fabricacao?.[0],
        capacidade_carga: fieldErrors.capacidade_carga?.[0],
        status: fieldErrors.status?.[0],
      });
      return;
    }
    setErros({});

    setSalvando(true);
    const resposta = veiculoId ? await atualizarVeiculo(veiculoId, resultado.data) : await criarVeiculo(resultado.data);
    setSalvando(false);

    if (!resposta.ok) {
      // Placa duplicada é uma validação, não um erro de rede: aparece junto do campo Placa também.
      if (resposta.campo) setErros({ [resposta.campo]: resposta.mensagem });
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setFeedback({
      mensagem: veiculoId ? 'Veículo atualizado.' : 'Veículo cadastrado.',
      tone: 'success',
    });
  }

  // Desativar e reativar moram aqui, no fim do Editar, e não mais no "Mais opções" da lista com o Alert do
  // sistema: é o mesmo lugar em Categorias, Formas de pagamento, Rotas e Veículos.
  async function handleAlterarAtiva(reativar: boolean) {
    if (!veiculoId) return;
    setAlterandoAtiva(true);
    // Só Disponível desativa (INA-08) e só Desativado reativa (REA-04): o repositório confere de novo no
    // banco, porque uma viagem pode ter começado depois de a tela abrir.
    const resposta = reativar ? await reativarVeiculo(veiculoId) : await inativarVeiculo(veiculoId);
    setAlterandoAtiva(false);

    if (!resposta.ok) {
      setFeedback({ mensagem: resposta.mensagem, tone: 'error' });
      return;
    }

    setStatusVeiculo(resposta.data.status);
    setStatusSalvo(resposta.data.status);
    if (!reativar) {
      setFeedback({ mensagem: 'Veículo desativado.', tone: 'success', desfazer: true });
      return;
    }
    // Com viagem ou manutenção aberta o banco devolve o veículo com esse status (trigger da EIX-81), e a
    // mensagem diz isso para o gestor não esperar vê-lo como Disponível.
    setFeedback({
      mensagem:
        resposta.data.status === 'Disponivel'
          ? 'Veículo reativado.'
          : `Veículo reativado como ${rotuloStatusVeiculo[resposta.data.status]}.`,
      tone: 'success',
    });
  }

  function handleDesfazer() {
    desfazendo.current = true;
    handleAlterarAtiva(true);
  }

  function handleFeedbackDismiss() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (desfazendo.current) {
      desfazendo.current = false;
      return;
    }
    if (eraSucesso) router.back();
  }

  const desativado = statusSalvo === 'Inativo';

  if (status === 'carregando') {
    return (
      <Screen underHeader>
        {/* O formato do formulário aparece enquanto o veículo carrega: sem spinner no vazio. */}
        <Column gap="lg">
          <Skeleton height="xxl" accessibilityLabel="Carregando veículo" />
          <Skeleton height="xxl" />
          <Skeleton height="xxl" />
        </Column>
      </Screen>
    );
  }

  if (status === 'erro') {
    return (
      <Screen align="center" underHeader>
        <EmptyState title="Não foi possível carregar o veículo" description={erroCarga ?? undefined} actionLabel="Tentar novamente" onAction={tentarDeNovo} />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen
      underHeader
      scroll
      overlay={
        feedback && (
          <Snackbar
            message={feedback.mensagem}
            tone={feedback.tone}
            // Com "Desfazer", o Snackbar usa o tempo maior dele, para dar tempo de tocar.
            duration={feedback.desfazer ? undefined : 1200}
            action={feedback.desfazer ? { label: 'Desfazer', onPress: handleDesfazer } : undefined}
            onDismiss={handleFeedbackDismiss}
          />
        )
      }
    >
      <Column gap="lg">
        {!modoEdicao && <Text tone="body">Cadastre o caminhão com a placa e os dados do documento.</Text>}

        {desativado && (
          <Aviso tom="info" icone="bloqueado" titulo="Veículo desativado">
            Não aparece na abertura de viagens nem nas manutenções. Para usar de novo, reative no fim da tela.
          </Aviso>
        )}

        <Column gap="md">
          <Input
            label="Placa"
            icone="frota"
            placeholder="AAA-1234 ou AAA1A23"
            value={placa}
            onChangeText={(texto) => setPlaca(mascararPlaca(texto))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={TAMANHO_PLACA + 1}
            error={erros.placa}
          />
          <Input label="Marca" placeholder="Ex.: Volvo" value={marca} onChangeText={setMarca} error={erros.marca} />
          <Input label="Modelo" placeholder="Ex.: FH 540" value={modelo} onChangeText={setModelo} error={erros.modelo} />
          <Input
            label="Ano de fabricação"
            icone="calendario"
            placeholder="Ex.: 2020"
            value={anoFabricacao}
            onChangeText={setAnoFabricacao}
            keyboardType="number-pad"
            error={erros.ano_fabricacao}
          />
          <Input
            label="Capacidade de carga (toneladas)"
            placeholder="Ex.: 12,5"
            value={capacidade}
            onChangeText={setCapacidade}
            keyboardType="decimal-pad"
            error={erros.capacidade_carga}
          />

          {!desativado && (
            // Seletor em vez de abas: "Em Manutenção" cabia cortado numa fileira de três. O erro sai
            // igual ao dos outros campos (ícone, vermelho e alerta para o leitor de tela).
            <Select
              label="Status"
              value={statusVeiculo}
              options={opcoesStatus}
              onChange={(valor) => setStatusVeiculo(valor as StatusVeiculo)}
              error={erros.status}
            />
          )}
        </Column>

        {/* Um botão preenchido só por tela (DESIGN_CYAN §7); o rótulo diz o que o toque faz. */}
        <Column gap="sm">
          <Button
            label={modoEdicao ? 'Salvar alterações' : 'Cadastrar veículo'}
            onPress={handleSalvar}
            loading={salvando}
            disabled={alterandoAtiva}
          />
          <Button label="Cancelar" variant="ghost" disabled={salvando || alterandoAtiva} onPress={() => router.back()} />
        </Column>

        {/* Em viagem ou em manutenção o veículo não desativa (INA-08): a tela diz o porquê, sem botão. */}
        {modoEdicao && (statusSalvo === 'EmViagem' || statusSalvo === 'EmManutencao') && (
          <View style={styles.status}>
            <Text variant="bodySm" tone="body">
              Para desativar, o veículo precisa estar disponível: sem viagem nem manutenção em aberto.
            </Text>
          </View>
        )}

        {modoEdicao && (statusSalvo === 'Disponivel' || desativado) && (
          <View style={styles.status}>
            {/* Ação de status no fim, longe da ação primária, com a consequência dita embaixo (DESIGN_CYAN §7,
                botão de perigo). Reativar não é grave: botão secundário. */}
            <Column gap="sm">
              <Button
                label={!desativado ? 'Desativar veículo' : 'Reativar veículo'}
                variant={!desativado ? 'danger' : 'ghost'}
                onPress={() => handleAlterarAtiva(desativado)}
                loading={alterandoAtiva}
                disabled={salvando}
              />
              <Text variant="bodySm" tone="body">
                {!desativado
                  ? 'Ele some da abertura de viagens e das manutenções. O histórico continua com ele.'
                  : 'Ele volta à frota. Com viagem ou manutenção em aberto, volta com esse status.'}
              </Text>
            </Column>
          </View>
        )}
      </Column>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Afasta a ação de status do "Salvar": as duas não podem parecer a mesma decisão.
  status: {
    marginTop: spacing.lg,
  },
});
