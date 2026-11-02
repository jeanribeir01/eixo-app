// Dono da sessão local. O sync precisa carimbar `outbox.usuario_id` e o repositório precisa saber
// para qual conta está gravando. Um módulo separado evita o ciclo repositório → store → repositório.
let usuarioIdAtual: string | null = null;
// Cada troca de conta (inclusive logout) incrementa a geração. Uma sincronização que começou na
// conta anterior compara a geração antes de gravar: a resposta atrasada não pode contaminar o cache
// da conta nova.
let geracaoAtual = 0;

export function definirUsuarioLocal(usuarioId: string | null): void {
  usuarioIdAtual = usuarioId;
  geracaoAtual += 1;
}

export function obterUsuarioLocal(): string | null {
  return usuarioIdAtual;
}

export function obterGeracaoLocal(): number {
  return geracaoAtual;
}

// A sessão pode mudar enquanto uma requisição está em voo. Quem começou numa geração confere esta
// função antes de cada escrita local: o resultado atrasado é descartado em vez de contaminar o
// cache da conta que acabou de entrar. Sem geração informada, não há o que comparar.
export function sessaoLocalAtual(geracaoLocal?: number): boolean {
  return geracaoLocal === undefined || geracaoAtual === geracaoLocal;
}
