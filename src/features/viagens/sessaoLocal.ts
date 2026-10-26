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
