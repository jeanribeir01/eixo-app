import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { useProfile } from '@/features/auth/profileStore';
import { listarRotas } from '@/features/rotas/rotasRepository';
import type { RotaComViagens } from '@/features/rotas/types';
import { listarUsuarios } from '@/features/usuarios/usuariosRepository';
import { buscarVeiculoPorId, listarVeiculosSelecionaveis } from '@/features/veiculos/repository';
import { rotuloStatusVeiculo, type Veiculo } from '@/features/veiculos/types';
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
import { MENSAGENS_ERRO_VIAGEM, abrirViagem, buscarUltimoHodometro } from './viagensRepository';

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

  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [rotas, setRotas] = useState<RotaComViagens[]>([]);
  const [motoristas, setMotoristas] = useState<SelectOption[]>([]);

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

  // Carrega listas de veículos, rotas e motoristas
  useEffect(() => {
    let cancelado = false;

    async function carregarAuxiliares() {
      setCarregandoDados(true);
      setErroCarregamento(null);

      // "viagem" só devolve veículo Disponível: inativo e em manutenção nem aparecem, e o
      // trigger do banco continua sendo a barreira para a corrida com outra abertura.
      const [resVeiculos, resRotas] = await Promise.all([
        listarVeiculosSelecionaveis('viagem'),
        listarRotas(),
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

      setVeiculos(resVeiculos.data);
      // Apenas rotas ativas para seleção
      setRotas(resRotas.data.filter((r) => r.ativa));

      // Se for Motorista, fixa nele mesmo (regra RLS-04 do banco)
      if (ehMotorista && usuario) {
        setMotoristas([{ value: usuario.id, label: usuario.nome, description: usuario.email }]);
        setMotoristaId(usuario.id);
      } else if (ehAdminOuGestor && usuario) {
        // Admin/Gestor abre viagem para motoristas, mas não os exibe como opção. O próprio
        // usuário continua na lista para ser o padrão, já que o RLS permite abrir para si.
        const resUsuarios = await listarUsuarios();

        if (cancelado) return;

        if (!resUsuarios.ok) {
          setErroCarregamento(resUsuarios.mensagem);
          setCarregandoDados(false);
          return;
        }

        const opcoes = resUsuarios.data
          .filter(
            (u) =>
              u.status === 'Ativo' &&
              (u.perfil.nome === 'Motorista' || u.id === usuario.id),
          )
          .map((u) => ({
            value: u.id,
            label: u.nome,
            description: u.email,
          }));

        setMotoristas(opcoes);
        setMotoristaId(usuario.id);
      }

      setCarregandoDados(false);
    }

    carregarAuxiliares();

    return () => {
      cancelado = true;
      // Uma resposta de veículo ainda em voo não pode voltar depois de a tela sair.
      requisicaoVeiculoRef.current += 1;
    };
  }, [ehAdminOuGestor, ehMotorista, usuario]);

  // Ao selecionar um veículo, confere a disponibilidade e (Admin/Gestor) o último hodômetro.
  async function aoSelecionarVeiculo(id: string) {
    const requisicao = requisicaoVeiculoRef.current + 1;
    requisicaoVeiculoRef.current = requisicao;

    setVeiculoId(id);
    setErros((prev) => ({ ...prev, veiculo_id: undefined }));
    // O hodômetro pertence ao veículo selecionado: limpa antes de consultar o novo.
    setHodometroInicial('');
    setUltimoHodometroVeiculo(null);

    // A disponibilidade vem de `veiculo.status`, não de `viagem`: o RLS de `viagem` esconde
    // a viagem aberta por outro motorista, mas o status do veículo é visível a todos e o
    // trigger `sincroniza_status_veiculo` o mantém atualizado.
    const resVeiculo = await buscarVeiculoPorId(id);
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

    // Consultas diretas a `viagem` também respeitam o RLS: para o Motorista, o "último
    // hodômetro" pode ser de uma viagem que ele não enxerga. Só Admin/Gestor, que veem todas
    // as viagens, recebem o valor; para o Motorista, o banco valida no insert (VG004) sem
    // expor o hodômetro de uma viagem alheia.
    if (!ehAdminOuGestor) return;

    // Consulta o último hodômetro final registrado para sugerir/preencher o inicial
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

    // REGRA CRÍTICA: km_rodado NUNCA é enviado no insert
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
    setFeedback({ mensagem: 'Viagem aberta com sucesso!', tone: 'success' });
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
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : erroCarregamento ? (
        <EmptyState
          icon="viagens"
          title="Erro ao carregar dados"
          description={erroCarregamento}
          actionLabel="Tentar novamente"
          onAction={() => router.replace('/viagens/nova')}
        />
      ) : (
        <Column gap="lg">
          <Card>
            <Column gap="md">
              <Text variant="subheading">Informações da nova viagem</Text>

              {/* 1. Seleção de Veículo */}
              <Select
                label="Veículo"
                placeholder="Selecione o veículo"
                options={opcoesVeiculos}
                value={veiculoId}
                onChange={aoSelecionarVeiculo}
                error={erros.veiculo_id}
              />

              {/* 2. Seleção de Rota */}
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

              {/* 3. Seleção de Motorista */}
              <Select
                label="Motorista"
                placeholder="Selecione o motorista"
                options={motoristas}
                value={motoristaId}
                disabled={ehMotorista}
                onChange={(valor) => {
                  setMotoristaId(valor);
                  setErros((prev) => ({ ...prev, motorista_id: undefined }));
                }}
                error={erros.motorista_id}
              />

              {/* 4. Apontamento de Hodômetro Inicial */}
              <Input
                label="Hodômetro Inicial (km)"
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
