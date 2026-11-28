import { create } from 'zustand';

// Se o aparelho está com internet, num lugar que qualquer módulo pode ler. Quem escreve é o listener
// de rede da sincronização de viagens (startNetworkSyncListener), o único que já acompanha a conexão.
// Mora em src/lib, e não em features/viagens, para o Caixa ler sem importar a Frota (RNF08).
type EstadoDaConexao = {
  online: boolean;
  definirOnline: (online: boolean) => void;
};

// Começa online: até a primeira leitura da rede, sem certeza, a tela tenta carregar.
export const useConexaoStore = create<EstadoDaConexao>((set) => ({
  online: true,
  definirOnline: (online) => set({ online }),
}));

export function useOnline(): boolean {
  return useConexaoStore((estado) => estado.online);
}

export const MENSAGEM_SEM_INTERNET = 'Sem internet. A tela carrega sozinha quando a conexão voltar.';
