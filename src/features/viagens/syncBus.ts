// Ponte entre as escritas locais e o sincronizador. O repositório não importa o store (isso criaria
// um ciclo); ele só avisa "gravei". Quem estiver ouvindo decide quando drenar a outbox.
type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

export function aoEscreverLocal(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function notificarEscritaLocal(): void {
  for (const ouvinte of ouvintes) {
    try {
      ouvinte();
    } catch {
      // Um ouvinte com defeito não pode impedir a escrita local já concluída.
    }
  }
}
