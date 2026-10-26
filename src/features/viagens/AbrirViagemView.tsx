import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useProfile } from '@/features/auth/profileStore';
import { rotuloStatusVeiculo } from '@/features/veiculos/types';
import {
  Button,
  Card,
  Column,
  EmptyState,
  Input,
  Screen,
  Select,
  Snackbar,
  Text,
  colors,
  spacing,
  type SelectOption,
} from '@/ui';

import { formatarHodometro, parseHodometro } from './calculo';
import { abrirViagemComUltimoHodometroSchema } from './schema';
import type { MotoristaSelecionavel, RotaSelecionavel, VeiculoSelecionavel } from './types';
import {
  MENSAGENS_ERRO_VIAGEM,
  abrirViagem,
  buscarUltimoHodometro,
  buscarVeiculoParaViagem,
  listarMotoristasParaViagem,
  listarRotasParaViagem,
  listarVeiculosParaViagem,
} from './viagensRepository';

type ErrosFormulario = {
  veiculo_id?: string;
  rota_id?: string;
  motorista_id?: string;
  hodometro_inicial?: string;
};

type Feedback = {
  mensagem: string;
  tone: 'success' | 'error';
};

const MENSAGEM_VEICULO_INDISPONIVEL = {
  EmViagem: MENSAGENS_ERRO_VIAGEM.VG001,
  EmManutencao: MENSAGENS_ERRO_VIAGEM.VG002,
  Inativo: MENSAGENS_ERRO_VIAGEM.VG003,
} as const;

export function AbrirViagemView() {
  const router = useRouter();
  const { usuario } = useProfile();
  // Cada troca de veículo invalida as consultas da anterior: a resposta atrasada do veículo A
  // não pode preencher o hodômetro já limpo para o veículo B.
  const requisicaoVeiculoRef = useRef(0);

  const [tentativa, setTentativa] = useState(0);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [veiculos, setVeiculos] = useState<VeiculoSelecionavel[]>([]);
  const [rotas, setRotas] = useState<RotaSelecionavel[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaSelecionavel[]>([]);

  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [motoristaId, setMotoristaId] = useState<string | null>(usuario?.id ?? null);
  const [hodometroInicial, setHodometroInicial] = useState('');
  const [ultimoHodometroVeiculo, setUltimoHodometroVeiculo] = useState<number | null>(null);

  const [erros, setErros] = useState<ErrosFormulario>({});
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const ehMotorista = usuario?.perfil === 'Motorista';
  const ehAdminOuGestor = usuario?.perfil === 'Admin' || usuario?.perfil === 'Gestor de Frota';

  useEffect(() => {
    let cancelado = false;

    async function carregarAuxiliares() {
      setCarregandoDados(true);
      setErroCarregamento(null);

      if (!usuario) {
        setErroCarregamento('Sessão não identificada. Entre novamente para abrir uma viagem.');
        setCarregandoDados(false);
        return;
      }

      // Todas as listas vêm do cache local. No primeiro login ainda online, o sync grava esse
      // cache; depois disso a tela abre sem internet.
      const [resVeiculos, resRotas, resMotoristas] = await Promise.all([
        listarVeiculosParaViagem(),
        listarRotasParaViagem(),
        listarMotoristasParaViagem(usuario),
      ]);

      if (cancelado) return;

      if (!resVeiculos.ok) {
        setErroCarregamento(resVeiculos.mensagem);
        setCarregandoDados(false);
        return;
      }
      if (!resRotas.ok) {
        setErroCarregamento(resRotas.mensagem);
        setCarregandoDados(false);
        return;
      }
      if (!resMotoristas.ok) {
        setErroCarregamento(resMotoristas.mensagem);
        setCarregandoDados(false);
        return;
      }

      setVeiculos(resVeiculos.data);
      setRotas(resRotas.data);

      if (ehMotorista) {
        // RLS-04 do banco: o Motorista só abre para si mesmo.
        setMotoristas([{ id: usuario.id, nome: usuario.nome, email: usuario.email }]);
        setMotoristaId(usuario.id);
      } else {
        // Admin/Gestor abre para motoristas; o próprio usuário também aparece para ser o padrão.
        setMotoristas(resMotoristas.data);
        setMotoristaId((atual) => atual ?? usuario.id);
      }

      setCarregandoDados(false);
    }

    carregarAuxiliares();

    return () => {
      cancelado = true;
      // Uma resposta de veículo ainda em voo não pode voltar depois de a tela sair.
      requisicaoVeiculoRef.current += 1;
    };
  }, [ehMotorista, tentativa, usuario]);

  async function aoSelecionarVeiculo(id: string) {
    const requisicao = requisicaoVeiculoRef.current + 1;
    requisicaoVeiculoRef.current = requisicao;

    setVeiculoId(id);
    setErros((prev) => ({ ...prev, veiculo_id: undefined }));
    // O hodômetro pertence ao veículo selecionado: limpa antes de consultar o novo.
    setHodometroInicial('');
    setUltimoHodometroVeiculo(null);

    const resVeiculo = await buscarVeiculoParaViagem(id);
    if (requisicao !== requisicaoVeiculoRef.current) return;

    if (!resVeiculo.ok) {
      setErros((prev) => ({ ...prev, veiculo_id: resVeiculo.mensagem }));
      return;
    }

    const statusVeiculo = resVeiculo.data.status;
    if (statusVeiculo !== 'Disponivel') {
      setErros((prev) => ({
        ...prev,
        veiculo_id: MENSAGEM_VEICULO_INDISPONIVEL[statusVeiculo],
      }));
      return;
    }

    // Para Motorista, o cache de viagens pode não conter o último hodômetro de viagens que o
    // RLS esconde. O servidor valida o VG004 no sync; exibir um valor parcial seria pior.
    if (!ehAdminOuGestor) return;

    const resHodometro = await buscarUltimoHodometro(id);
    if (requisicao !== requisicaoVeiculoRef.current) return;

    if (resHodometro.ok && resHodometro.data !== null) {
      setUltimoHodometroVeiculo(resHodometro.data);
      setHodometroInicial(String(resHodometro.data));
    }
  }

  async function submeter() {
    if (salvando) return;

    const validacao = abrirViagemComUltimoHodometroSchema(ultimoHodometroVeiculo).safeParse({
      veiculo_id: veiculoId ?? '',
      rota_id: rotaId ?? '',
      motorista_id: motoristaId ?? '',
      hodometro_inicial: parseHodometro(hodometroInicial) ?? Number.NaN,
    });

    if (!validacao.success) {
      // As mensagens vêm do schema; a tela não repete texto de validação.
      const fieldErrors = z.flattenError(validacao.error).fieldErrors;
      setErros({
        veiculo_id: fieldErrors.veiculo_id?.[0],
        rota_id: fieldErrors.rota_id?.[0],
        motorista_id: fieldErrors.motorista_id?.[0],
        hodometro_inicial: fieldErrors.hodometro_inicial?.[0],
      });
      return;
    }

    setSalvando(true);
    setErros({});

    // REGRA CRÍTICA: km_rodado NUNCA entra no insert (coluna gerada no Postgres).
    const resultado = await abrirViagem({
      veiculo_id: validacao.data.veiculo_id,
      rota_id: validacao.data.rota_id,
      motorista_id: validacao.data.motorista_id,
      hodometro_inicial: validacao.data.hodometro_inicial,
    });

    if (!resultado.ok) {
      setSalvando(false);
      if (resultado.campo) {
        setErros({ [resultado.campo]: resultado.mensagem });
      }
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    // O botão segue em loading até a tela fechar: sem setTimeout, o toque repetido durante a
    // mensagem de sucesso não abre uma segunda viagem.
    setFeedback({
      mensagem: 'Viagem aberta com sucesso! Os dados serão enviados quando houver conexão.',
      tone: 'success',
    });
  }

  function dispensarFeedback() {
    const eraSucesso = feedback?.tone === 'success';
    setFeedback(null);
    if (eraSucesso) router.back();
  }

  const opcoesVeiculos: SelectOption[] = veiculos.map((v) => ({
    value: v.id,
    label: `${v.placa} • ${v.modelo}`,
    description: `Status: ${rotuloStatusVeiculo[v.status]} | Capacidade: ${v.capacidade_carga} t`,
  }));

  const opcoesRotas: SelectOption[] = rotas.map((r) => ({
    value: r.id,
    label: `${r.cidade_origem}/${r.uf_origem} → ${r.cidade_destino}/${r.uf_destino}`,
    description: `Distância estimada: ${r.distancia_estimada_km} km`,
  }));

  const opcoesMotoristas: SelectOption[] = motoristas.map((m) => ({
    value: m.id,
    label: m.nome,
    description: m.email ?? undefined,
  }));

  const semVeiculos = !carregandoDados && !erroCarregamento && veiculos.length === 0;
  const semRotas = !carregandoDados && !erroCarregamento && rotas.length === 0;
  const semDados = semVeiculos || semRotas;

  return (
    <Screen
      scroll
      underHeader
      overlay={
        feedback ? (
          <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={dispensarFeedback} />
        ) : undefined
      }
    >
      {carregandoDados ? (
        <View style={styles.centro}>
          <ActivityIndicator
            size="large"
            color={colors.accent}
            accessibilityLabel="Carregando dados da viagem"
          />
        </View>
      ) : erroCarregamento ? (
        <EmptyState
          icon="viagens"
          title="Não foi possível carregar os dados"
          description={erroCarregamento}
          actionLabel="Tentar novamente"
          onAction={() => setTentativa((atual) => atual + 1)}
        />
      ) : semDados ? (
        <EmptyState
          icon="viagens"
          title={semVeiculos ? 'Nenhum veículo disponível' : 'Nenhuma rota ativa'}
          description={
            semVeiculos
              ? 'Todos os veículos estão em viagem ou em manutenção, ou o cache ainda não foi baixado. Conecte-se para atualizar.'
              : 'Cadastre uma rota ativa ou conecte-se à internet para atualizar os dados.'
          }
          actionLabel="Tentar novamente"
          onAction={() => setTentativa((atual) => atual + 1)}
        />
      ) : (
        <Column gap="lg">
          <Card>
            <Column gap="md">
              <Text variant="subheading">Informações da nova viagem</Text>

              <Select
                label="Veículo"
                placeholder="Selecione o veículo"
                options={opcoesVeiculos}
                value={veiculoId}
                onChange={aoSelecionarVeiculo}
                error={erros.veiculo_id}
              />

              <Select
                label="Rota"
                placeholder="Selecione a rota"
                options={opcoesRotas}
                value={rotaId}
                onChange={(valor) => {
                  setRotaId(valor);
                  setErros((prev) => ({ ...prev, rota_id: undefined }));
                }}
                error={erros.rota_id}
              />

              <Select
                label="Motorista"
                placeholder="Selecione o motorista"
                options={opcoesMotoristas}
                value={motoristaId}
                disabled={ehMotorista}
                onChange={(valor) => {
                  setMotoristaId(valor);
                  setErros((prev) => ({ ...prev, motorista_id: undefined }));
                }}
                error={erros.motorista_id}
              />

              <Input
                label="Hodômetro inicial (km)"
                placeholder="Ex.: 15000"
                keyboardType="numeric"
                value={hodometroInicial}
                onChangeText={(texto) => {
                  setHodometroInicial(texto);
                  setErros((prev) => ({ ...prev, hodometro_inicial: undefined }));
                }}
                error={erros.hodometro_inicial}
              />

              {ehAdminOuGestor && ultimoHodometroVeiculo !== null && (
                <Text variant="caption" tone="muted">
                  {`Último hodômetro final registrado: ${formatarHodometro(ultimoHodometroVeiculo)} km`}
                </Text>
              )}
            </Column>
          </Card>

          {/* Único botão preenchido cyan da tela (DESIGN_CYAN §1) */}
          <Button
            label="Abrir viagem"
            variant="primary"
            loading={salvando}
            disabled={salvando}
            onPress={submeter}
          />
        </Column>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centro: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
