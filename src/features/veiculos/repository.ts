import { PlacaDuplicadaError, VeiculoNaoEncontradoError } from './errors';
import { normalizarPlaca } from './placa';
import type { AtualizarVeiculoInput, FiltroVeiculos, NovoVeiculoInput, Veiculo } from './types';

export type VeiculoRepositorio = {
  listar(filtro?: FiltroVeiculos): Veiculo[];
  criar(id: string, input: NovoVeiculoInput): Veiculo;
  editar(id: string, input: AtualizarVeiculoInput): Veiculo;
  inativar(id: string): Veiculo;
};

// Repositório mock em memória: a tabela `veiculo` no Supabase chega pela EIX-27. Quando ela
// existir, este arquivo é trocado por um repositório que fala com `supabase-js`, mantendo a
// mesma interface `VeiculoRepositorio` para não quebrar quem já a consome.
export function createVeiculoRepositorioEmMemoria(seed: Veiculo[] = []): VeiculoRepositorio {
  const veiculos = new Map<string, Veiculo>(seed.map((veiculo) => [veiculo.id, veiculo]));

  function existePlacaDuplicada(placaNormalizada: string, ignorarId?: string): boolean {
    for (const veiculo of veiculos.values()) {
      if (veiculo.id !== ignorarId && veiculo.placa === placaNormalizada) {
        return true;
      }
    }
    return false;
  }

  function obterOuFalhar(id: string): Veiculo {
    const veiculo = veiculos.get(id);
    if (!veiculo) {
      throw new VeiculoNaoEncontradoError(id);
    }
    return veiculo;
  }

  return {
    listar(filtro) {
      const busca = filtro?.busca?.trim().toLowerCase() ?? '';
      const buscaPlaca = busca ? normalizarPlaca(busca) : '';

      return Array.from(veiculos.values()).filter((veiculo) => {
        if (filtro?.status && veiculo.status !== filtro.status) {
          return false;
        }

        if (busca) {
          const combinaPlaca = buscaPlaca.length > 0 && veiculo.placa.includes(buscaPlaca);
          const combinaModelo = veiculo.modelo.toLowerCase().includes(busca);
          if (!combinaPlaca && !combinaModelo) {
            return false;
          }
        }

        return true;
      });
    },

    criar(id, input) {
      const placaNormalizada = normalizarPlaca(input.placa);
      if (existePlacaDuplicada(placaNormalizada)) {
        throw new PlacaDuplicadaError(placaNormalizada);
      }

      const agora = new Date().toISOString();
      const veiculo: Veiculo = {
        ...input,
        id,
        placa: placaNormalizada,
        status: 'Disponivel',
        createdAt: agora,
        updatedAt: agora,
      };

      veiculos.set(id, veiculo);
      return veiculo;
    },

    editar(id, input) {
      const existente = obterOuFalhar(id);
      const placaNormalizada = normalizarPlaca(input.placa);
      if (existePlacaDuplicada(placaNormalizada, id)) {
        throw new PlacaDuplicadaError(placaNormalizada);
      }

      const atualizado: Veiculo = {
        ...existente,
        ...input,
        placa: placaNormalizada,
        updatedAt: new Date().toISOString(),
      };

      veiculos.set(id, atualizado);
      return atualizado;
    },

    inativar(id) {
      const existente = obterOuFalhar(id);
      const inativado: Veiculo = {
        ...existente,
        status: 'Inativo',
        updatedAt: new Date().toISOString(),
      };

      veiculos.set(id, inativado);
      return inativado;
    },
  };
}
