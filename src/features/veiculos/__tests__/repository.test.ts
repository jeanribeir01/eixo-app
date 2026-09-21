import { PlacaDuplicadaError, VeiculoNaoEncontradoError } from '../errors';
import { createVeiculoRepositorioEmMemoria } from '../repository';
import type { NovoVeiculoInput } from '../types';

function novoVeiculo(sobrescreve: Partial<NovoVeiculoInput> = {}): NovoVeiculoInput {
  return {
    placa: 'ABC-1234',
    marca: 'Volvo',
    modelo: 'FH 540',
    anoFabricacao: 2020,
    capacidadeCarga: 12.5,
    ...sobrescreve,
  };
}

describe('createVeiculoRepositorioEmMemoria', () => {
  it('cria um veículo com status Disponivel e placa normalizada', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    const veiculo = repositorio.criar('v1', novoVeiculo());

    expect(veiculo.placa).toBe('ABC1234');
    expect(veiculo.status).toBe('Disponivel');
  });

  it('bloqueia placa duplicada ao criar, mesmo em formato diferente', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    repositorio.criar('v1', novoVeiculo({ placa: 'ABC-1234' }));

    expect(() => repositorio.criar('v2', novoVeiculo({ placa: 'abc1234' }))).toThrow(PlacaDuplicadaError);
  });

  it('bloqueia placa duplicada ao editar para a placa de outro veículo', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    repositorio.criar('v1', novoVeiculo({ placa: 'ABC-1234' }));
    repositorio.criar('v2', novoVeiculo({ placa: 'DEF-5678' }));

    expect(() => repositorio.editar('v2', novoVeiculo({ placa: 'abc-1234' }))).toThrow(PlacaDuplicadaError);
  });

  it('permite editar mantendo a própria placa', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    repositorio.criar('v1', novoVeiculo({ placa: 'ABC-1234' }));

    const atualizado = repositorio.editar('v1', novoVeiculo({ placa: 'abc-1234', modelo: 'FH 460' }));
    expect(atualizado.modelo).toBe('FH 460');
  });

  it('lista com busca por placa e por modelo', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    repositorio.criar('v1', novoVeiculo({ placa: 'ABC-1234', modelo: 'FH 540' }));
    repositorio.criar('v2', novoVeiculo({ placa: 'DEF-5678', modelo: 'Actros' }));

    expect(repositorio.listar({ busca: 'abc1234' }).map((v) => v.id)).toEqual(['v1']);
    expect(repositorio.listar({ busca: 'actros' }).map((v) => v.id)).toEqual(['v2']);
  });

  it('lista com filtro por status', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    repositorio.criar('v1', novoVeiculo({ placa: 'ABC-1234' }));
    repositorio.criar('v2', novoVeiculo({ placa: 'DEF-5678' }));
    repositorio.inativar('v2');

    expect(repositorio.listar({ status: 'Inativo' }).map((v) => v.id)).toEqual(['v2']);
    expect(repositorio.listar({ status: 'Disponivel' }).map((v) => v.id)).toEqual(['v1']);
  });

  it('inativa sem remover o registro (soft delete)', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();
    repositorio.criar('v1', novoVeiculo());

    const inativado = repositorio.inativar('v1');
    expect(inativado.status).toBe('Inativo');
    expect(repositorio.listar().map((v) => v.id)).toContain('v1');
  });

  it('lança erro claro ao editar ou inativar veículo inexistente', () => {
    const repositorio = createVeiculoRepositorioEmMemoria();

    expect(() => repositorio.editar('inexistente', novoVeiculo())).toThrow(VeiculoNaoEncontradoError);
    expect(() => repositorio.inativar('inexistente')).toThrow(VeiculoNaoEncontradoError);
  });
});
