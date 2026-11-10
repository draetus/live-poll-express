import { isIPv6 } from "node:net";
import type { RequestHandler } from "express";
import { RateLimitedError } from "../../domain/errors.js";

export interface RateLimit {
  max: number;
  windowMs: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

export type HitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * Janela fixa por chave (IP): conta as requisições em blocos de `windowMs`.
 *
 * Diferente do limitador do WebSocket (um por conexão), este guarda MUITAS chaves num Map,
 * então precisa de limpeza. Em vez de um setInterval (que mantém o processo vivo e
 * precisa ser parado em testes e no shutdown), a limpeza acontece no próprio uso:
 * no máximo uma varredura por janela.
 */
export class FixedWindowLimiter {
  private readonly entries = new Map<string, Entry>();
  private nextSweepAt: number;

  constructor(
    private readonly limit: RateLimit,
    private readonly now: () => number = Date.now,
  ) {
    this.nextSweepAt = now() + limit.windowMs;
  }

  hit(key: string): HitResult {
    const time = this.now();
    this.sweep(time);

    let entry = this.entries.get(key);
    if (!entry || time >= entry.resetAt) {
      entry = { count: 0, resetAt: time + this.limit.windowMs };
      this.entries.set(key, entry);
    }

    entry.count++;
    if (entry.count <= this.limit.max) return { allowed: true };
    return { allowed: false, retryAfterMs: entry.resetAt - time };
  }

  /** Quantas chaves estão guardadas (para os testes verificarem a limpeza). */
  get size(): number {
    return this.entries.size;
  }

  private sweep(time: number): void {
    if (time < this.nextSweepAt) return;
    this.nextSweepAt = time + this.limit.windowMs;
    for (const [key, entry] of this.entries) {
      if (time >= entry.resetAt) this.entries.delete(key);
    }
  }
}

/**
 * Chave do cliente a partir do IP.
 * IPv4: o próprio endereço. IPv6: só os primeiros 64 bits (o "prefixo /64"), porque um
 * provedor costuma entregar um /64 inteiro para CADA cliente: limitando o endereço
 * completo, uma pessoa trocaria de IP à vontade (são 2^64 endereços) e nunca seria barrada.
 */
export function clientKey(ip: string | undefined): string {
  if (!ip) return "unknown";
  // IPv4 escrito como IPv6 ("::ffff:203.0.113.5"), comum em servidores dual-stack.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1];
  if (!isIPv6(ip)) return ip;

  // Expande o "::" (grupos de zeros omitidos) para ter sempre 8 grupos.
  const [head, tail = ""] = ip.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...headGroups, ...Array(8 - headGroups.length - tailGroups.length).fill("0"), ...tailGroups]
    : headGroups;
  return `${groups
    .slice(0, 4)
    .map((g) => g.toLowerCase().replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/** Middleware: 429 com Retry-After quando o cliente passa do limite. */
export function rateLimit(limiter: FixedWindowLimiter): RequestHandler {
  return (req, _res, next) => {
    // req.ip respeita o "trust proxy" do app.ts: é o IP real do visitante, não o do Render.
    const result = limiter.hit(clientKey(req.ip));
    if (result.allowed) return next();
    next(new RateLimitedError(Math.ceil(result.retryAfterMs / 1000)));
  };
}
