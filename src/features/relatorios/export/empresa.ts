export const NOME_EMPRESA_PADRAO = 'Eixo Certo';

// Nome da empresa no cabeçalho do PDF (US14). Vem do .env porque o app não guarda o nome em lugar
// nenhum. O Expo só troca process.env.EXPO_PUBLIC_* quando a variável é escrita pelo nome completo,
// por isso o padrão do parâmetro lê a variável direto.
export function nomeDaEmpresa(valor: string | undefined = process.env.EXPO_PUBLIC_NOME_EMPRESA): string {
  const nome = valor?.trim();
  return nome ? nome : NOME_EMPRESA_PADRAO;
}
