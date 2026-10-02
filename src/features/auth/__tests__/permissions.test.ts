import {
  canSeeFinanceiro,
  canSeeFrota,
  isAdmin,
  isAprovado,
  type PerfilNome,
  type StatusUsuario,
} from '../permissions';

// Matriz da spec (EIX-30, "useProfile() e helpers" AC1–AC4): para cada perfil aprovado, quais
// helpers devolvem true. Os outros status sempre devolvem false.
const esperadoAprovado: Record<PerfilNome, { isAdmin: boolean; canSeeFinanceiro: boolean; canSeeFrota: boolean }> = {
  Admin: { isAdmin: true, canSeeFinanceiro: true, canSeeFrota: true },
  Financeiro: { isAdmin: false, canSeeFinanceiro: true, canSeeFrota: false },
  'Gestor de Frota': { isAdmin: false, canSeeFinanceiro: false, canSeeFrota: true },
  Motorista: { isAdmin: false, canSeeFinanceiro: false, canSeeFrota: false },
};

const perfis = Object.keys(esperadoAprovado) as PerfilNome[];

describe('permissions', () => {
  it.each(perfis)('perfil %s aprovado: isAdmin, canSeeFinanceiro e canSeeFrota seguem a matriz (AC1–AC3)', (perfil) => {
    const usuario = { perfil, status: 'Aprovado' as const };

    expect({
      isAdmin: isAdmin(usuario),
      canSeeFinanceiro: canSeeFinanceiro(usuario),
      canSeeFrota: canSeeFrota(usuario),
    }).toEqual(esperadoAprovado[perfil]);
    expect(isAprovado(usuario)).toBe(true);
  });

  const naoAprovados: StatusUsuario[] = ['AguardandoAprovacao', 'Bloqueado'];

  it.each(naoAprovados.flatMap((status) => perfis.map((perfil) => [status, perfil] as const)))(
    'status %s com perfil %s: todos os helpers devolvem false (AC4)',
    (status, perfil) => {
      const usuario = { perfil, status };

      expect([isAprovado(usuario), isAdmin(usuario), canSeeFinanceiro(usuario), canSeeFrota(usuario)]).toEqual([
        false,
        false,
        false,
        false,
      ]);
    },
  );

  it('sem usuário: todos os helpers devolvem false (AC4)', () => {
    expect([isAprovado(null), isAdmin(null), canSeeFinanceiro(null), canSeeFrota(null)]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
