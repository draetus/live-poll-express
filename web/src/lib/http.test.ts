import { describe, expect, it, vi } from "vitest";
import { apiError, json } from "../test/mock-api";
import { config } from "./config";
import { ApiError, isAbortError, request } from "./http";

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// fetch falso que só termina quando o sinal for abortado (simula servidor que não responde).
function hangingFetch() {
  return stubFetch(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
  );
}

describe("request", () => {
  it("calls the API base URL and returns the parsed JSON", async () => {
    const fetchMock = stubFetch(async () => json({ status: "ok" }));

    const data = await request<{ status: string }>("/health");

    expect(data).toEqual({ status: "ok" });
    // Compara com config.apiUrl, e não com "http://localhost:3000": no CI,
    // VITE_API_URL está definida e a URL base é outra.
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${config.apiUrl}/health`);
  });

  it("sends a JSON body with the right Content-Type", async () => {
    const fetchMock = stubFetch(async () => json({}, 201));

    await request("/polls", { method: "POST", body: { question: "Q?" } });

    const init = fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"question":"Q?"}');
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("turns an API error body into an ApiError with status and code", async () => {
    stubFetch(async () => apiError(409, "ALREADY_VOTED"));

    const error = await request("/x").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "ALREADY_VOTED" });
  });

  it("handles an error response that is not in the API format", async () => {
    stubFetch(async () => new Response("<html>Bad Gateway</html>", { status: 502 }));

    await expect(request("/x")).rejects.toMatchObject({ status: 502, code: "INTERNAL_ERROR" });
  });

  it("reports NETWORK_ERROR when the server cannot be reached", async () => {
    stubFetch(async () => Promise.reject(new TypeError("Failed to fetch")));

    await expect(request("/x")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("reports TIMEOUT when the server takes too long", async () => {
    hangingFetch();

    await expect(request("/x", { timeoutMs: 20 })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("reads Retry-After from a 429", async () => {
    stubFetch(async () => {
      const res = apiError(429, "RATE_LIMITED");
      res.headers.set("Retry-After", "42");
      return res;
    });

    await expect(request("/polls")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 42,
    });
  });

  it("ignores a Retry-After that is not a positive number of seconds", async () => {
    stubFetch(async () => {
      const res = apiError(429, "RATE_LIMITED");
      res.headers.set("Retry-After", "Wed, 21 Oct 2015 07:28:00 GMT");
      return res;
    });

    await expect(request("/polls")).rejects.toMatchObject({ retryAfterSeconds: undefined });
  });

  it("re-throws the caller's own abort untouched, so it can be ignored", async () => {
    hangingFetch();
    const controller = new AbortController();

    const pending = request("/x", { signal: controller.signal }).catch((err: unknown) => err);
    controller.abort();

    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(isAbortError(error)).toBe(true);
  });
});
