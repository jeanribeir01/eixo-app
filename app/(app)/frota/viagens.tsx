import { ViagensListView } from '@/features/viagens';

// Lista de viagens para quem não tem a aba Viagens (o Admin, que já tem 5 abas). Mesma tela da aba,
// sob o header nativo. Fica em `frota/viagens` e não em `viagens/index`: esse teria a URL da aba.
export default function ViagensDaFrotaRoute() {
  return <ViagensListView underHeader />;
}
