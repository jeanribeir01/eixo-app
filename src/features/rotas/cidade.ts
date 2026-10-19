// Duas formas do nome da cidade, cada uma com um papel:
// - `limparCidade` é o que vai para o banco. As checks `rota_cidade_origem_normalizada` e
//   `rota_cidade_destino_normalizada` (migration 20261014000200) recusam espaço nas pontas ou
//   repetido, então o app limpa antes de enviar. Maiúscula e acento ficam como o usuário digitou.
// - `chaveCidade` só serve para comparar. Repete o `normaliza_cidade()` do banco (migration
//   20261014000400), que é o que o índice `rota_trecho_unico` usa para achar rota duplicada.
//   Se a função do banco mudar, esta muda junto (AD-008: mesma regra nos dois lados).

export function limparCidade(cidade: string): string {
  return cidade.replace(/\s+/g, ' ').trim();
}

// Mesmas duas listas do `translate` do banco: cada letra da primeira vira a da mesma posição na
// segunda. As maiúsculas acentuadas estão na lista porque o banco não confia no `lower()` para elas.
const COM_ACENTO = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn';

function tirarAcentos(texto: string): string {
  return Array.from(texto, (letra) => {
    const posicao = COM_ACENTO.indexOf(letra);
    return posicao === -1 ? letra : SEM_ACENTO[posicao];
  }).join('');
}

// O banco aplica `normaliza_cidade` no nome já gravado (sempre limpo); aqui o texto pode vir
// direto do campo, por isso limpa os espaços antes.
export function chaveCidade(cidade: string): string {
  return tirarAcentos(limparCidade(cidade).toLowerCase());
}
