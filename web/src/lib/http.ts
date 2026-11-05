import type { ApiErrorBody, ErrorCode } from "@shared/api";
import { config } from "./config";

// Além dos códigos da API, dois que só existem no cliente: a requisição nem chegou
// ao servidor (rede) ou demorou demais (timeout).
export type ClientErrorCode = ErrorCode | "NETWORK_ERROR" | "TIMEOUT";

export class ApiError extends Error {
  constructor(
    readonly status: number, // 0 quando não houve resposta HTTP
    readonly code: ClientErrorCode,
    message: string,
    readonly details?: ApiErrorBody["error"]["details"],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  /** Cancela a requisição (ex.: o componente saiu da tela). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "code" in value.error
  );
}

// Ponto ÚNICO por onde o front fala com a API: URL base, JSON, timeout e erros.
// Quem chama recebe o dado já tipado ou um ApiError — nunca um Response cru.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const timeout = AbortSignal.timeout(timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    // Cancelamento pedido por quem chamou: repassamos como está (quem chamou ignora).
    if (signal?.aborted) throw err;
    if (timeout.aborted) throw new ApiError(0, "TIMEOUT", "The request timed out");
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server");
  }

  const data: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isApiErrorBody(data)) {
      const { code, message, details } = data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(
      response.status,
      "INTERNAL_ERROR",
      `Unexpected response (${response.status})`,
    );
  }

  return data as T;
}

/** true quando o erro é o nosso próprio cancelamento (cleanup), e não uma falha real. */
export function isAbortError(err: unknown): boolean {
  // Checamos o `name`, e não `instanceof DOMException`: em alguns ambientes (como o
  // jsdom dos testes) existem duas classes DOMException diferentes, e o instanceof falha.
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError";
}
