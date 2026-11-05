import type { ApiErrorBody, ErrorCode, PollView } from "@shared/api";
import { vi } from "vitest";

export interface MockRequest {
  body: unknown;
  headers: Headers;
  signal?: AbortSignal | null;
}

/** Chave no formato "MÉTODO /caminho", ex.: "POST /polls/seedTabs/votes". */
export type MockRoutes = Record<string, (request: MockRequest) => Response | Promise<Response>>;

// Troca o fetch global por um falso que responde conforme a rota.
// Rota sem handler responde 404, para o teste falhar de forma óbvia.
export function mockApi(routes: MockRoutes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const handler = routes[key];
    if (!handler) return apiError(404, "NOT_FOUND", `No mock for ${key}`);
    return handler({
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      headers: new Headers(init.headers),
      signal: init.signal,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

/** Responde depois de `ms`, mas rejeita na hora se a requisição for cancelada (como o fetch real). */
export function delayed(response: () => Response, ms: number, signal?: AbortSignal | null) {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => resolve(response()), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

export function apiError(status: number, code: ErrorCode, message: string = code) {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

export function makePollView(overrides: Partial<PollView> = {}): PollView {
  return {
    id: "pollAbc2",
    question: "Best day?",
    options: [
      { id: "1", text: "Saturday", votes: 0 },
      { id: "2", text: "Sunday", votes: 0 },
    ],
    totalVotes: 0,
    closed: false,
    createdAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}
