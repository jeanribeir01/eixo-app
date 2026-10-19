import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useProfile } from '@/features/auth/profileStore';
import { listarRotas } from '@/features/rotas/rotasRepository';
import type { RotaComViagens } from '@/features/rotas/types';
import { listarVeiculos } from '@/features/veiculos/repository';
import type { Veiculo } from '@/features/veiculos/types';
import { supabase } from '@/supabase/client';
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

import { formatarHodometro } from './calculo';
import { abrirViagem, buscarUltimoHodometro, buscarViagemEmAndamento } from './viagensRepository';

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

export function AbrirViagemView() {
  const router = useRouter();
  const { usuario } = useProfile();

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

  // Carrega listas de veículos, rotas e motoristas
  useEffect(() => {
    let cancelado = false;

    async function carregarAuxiliares() {
      setCarregandoDados(true);
      setErroCarregamento(null);

      const [resVeiculos, resRotas] = await Promise.all([listarVeiculos(), listarRotas()]);

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
      } else {
        // Admin ou Gestor: busca lista de motoristas / usuários ativos
        const { data: usuariosData } = await supabase
          .from('usuario')
          .select('id, nome, email')
          .eq('status', 'Ativo')
          .order('nome');

        if (!cancelado && usuariosData) {
          const opcoes = usuariosData.map((u) => ({
            value: u.id,
            label: u.nome,
            description: u.email,
          }));
          setMotoristas(opcoes);
          if (!motoristaId && usuario) {
            setMotoristaId(usuario.id);
          }
        }
      }

      setCarregandoDados(false);
    }

    carregarAuxiliares();

    return () => {
      cancelado = true;
    };
  }, [ehMotorista, usuario]);

  // Ao selecionar um veículo, consulta último hodômetro e se já há viagem em andamento
  async function aoSelecionarVeiculo(id: string) {
    setVeiculoId(id);
    setErros((prev) => ({ ...prev, veiculo_id: undefined }));

    // Consulta se o veículo já está em viagem
    const resAndamento = await buscarViagemEmAndamento(id);
    if (resAndamento.ok && resAndamento.data) {
      setErros((prev) => ({
        ...prev,
        veiculo_id: 'Este veículo já possui uma viagem em andamento.',
      }));
      return;
    }

    // Consulta o último hodômetro final registrado para sugerir/preencher o inicial
    const resHodometro = await buscarUltimoHodometro(id);
    if (resHodometro.ok && resHodometro.data !== null) {
      setUltimoHodometroVeiculo(resHodometro.data);
      setHodometroInicial(String(resHodometro.data));
    } else {
      setUltimoHodometroVeiculo(null);
    }
  }

  async function submeter() {
    const novosErros: ErrosFormulario = {};

    if (!veiculoId) novosErros.veiculo_id = 'Selecione um veículo.';
    if (!rotaId) novosErros.rota_id = 'Selecione uma rota.';
    if (!motoristaId) novosErros.motorista_id = 'Selecione um motorista.';

    const valorHodometro = Number(hodometroInicial.replace(',', '.'));
    if (!hodometroInicial.trim() || isNaN(valorHodometro) || valorHodometro < 0) {
      novosErros.hodometro_inicial = 'Informe um hodômetro inicial válido (maior ou igual a zero).';
    } else if (ultimoHodometroVeiculo !== null && valorHodometro < ultimoHodometroVeiculo) {
      novosErros.hodometro_inicial = `O hodômetro inicial não pode ser menor que o último final (${formatarHodometro(ultimoHodometroVeiculo)} km).`;
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    setSalvando(true);
    setErros({});

    // REGRA CRÍTICA: km_rodado NUNCA é enviado no insert
    const resultado = await abrirViagem({
      veiculo_id: veiculoId!,
      rota_id: rotaId!,
      motorista_id: motoristaId!,
      hodometro_inicial: valorHodometro,
    });

    setSalvando(false);

    if (!resultado.ok) {
      if (resultado.campo) {
        setErros({ [resultado.campo]: resultado.mensagem });
      }
      setFeedback({ mensagem: resultado.mensagem, tone: 'error' });
      return;
    }

    setFeedback({ mensagem: 'Viagem aberta com sucesso!', tone: 'success' });
    setTimeout(() => {
      router.back();
    }, 600);
  }

  const opcoesVeiculos: SelectOption[] = veiculos.map((v) => ({
    value: v.id,
    label: `${v.placa} • ${v.modelo}`,
    description: `Status: ${v.status} | Capacidade: ${v.capacidade_carga} t`,
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
          <Snackbar message={feedback.mensagem} tone={feedback.tone} onDismiss={() => setFeedback(null)} />
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

              {ultimoHodometroVeiculo !== null && (
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
