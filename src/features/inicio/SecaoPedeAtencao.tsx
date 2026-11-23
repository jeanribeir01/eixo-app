import { useRouter } from 'expo-router';

import { ListItem, ListSection } from '@/ui';

import type { ItemAtencao } from './pedeAtencao';

type SecaoPedeAtencaoProps = {
  itens: ItemAtencao[];
  // O que dizer quando não há nada: "tudo em dia" também é informação, e a seção não some.
  textoVazio: string;
};

// Seção "Pede atenção" dos Inícios: cada linha leva para a tela onde o assunto se resolve.
export function SecaoPedeAtencao({ itens, textoVazio }: SecaoPedeAtencaoProps) {
  const router = useRouter();

  return (
    <ListSection label="Pede atenção">
      {itens.length === 0 ? (
        <ListItem icon="sucesso" iconTone="success" title="Tudo em dia" subtitle={textoVazio} />
      ) : (
        itens.map((item) => (
          <ListItem
            key={item.id}
            icon={item.icone}
            iconTone={item.tom}
            title={item.titulo}
            subtitle={item.detalhe}
            onPress={() => router.push(item.href)}
          />
        ))
      )}
    </ListSection>
  );
}
