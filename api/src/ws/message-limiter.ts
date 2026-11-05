export interface MessageLimit {
  max: number;
  windowMs: number;
}

export const DEFAULT_MESSAGE_LIMIT: MessageLimit = { max: 20, windowMs: 10_000 };

/**
 * - "allow": processa a mensagem.
 * - "warn": estourou o limite nesta janela pela 1ª vez → avisa com RATE_LIMITED.
 * - "drop": continua acima do limite na mesma janela → ignora em silêncio.
 * - "disconnect": reincidiu em outra janela → fecha a conexão (código 1008).
 */
export type LimitVerdict = "allow" | "warn" | "drop" | "disconnect";

// Janela fixa: conta mensagens em blocos de `windowMs`; ao virar a janela, zera.
// Uma instância por conexão, então não precisa de Map nem de limpeza.
export class MessageLimiter {
  private windowStart: number;
  private count = 0;
  private warnedThisWindow = false;
  private strikes = 0;

  constructor(
    private readonly limit: MessageLimit = DEFAULT_MESSAGE_LIMIT,
    private readonly now: () => number = Date.now,
  ) {
    this.windowStart = now();
  }

  hit(): LimitVerdict {
    const time = this.now();
    if (time - this.windowStart >= this.limit.windowMs) {
      this.windowStart = time;
      this.count = 0;
      this.warnedThisWindow = false;
    }

    this.count++;
    if (this.count <= this.limit.max) return "allow";
    if (this.warnedThisWindow) return "drop";

    this.warnedThisWindow = true;
    this.strikes++;
    return this.strikes > 1 ? "disconnect" : "warn";
  }
}
