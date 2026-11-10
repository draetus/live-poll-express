import { ApiError, type ClientErrorCode } from "./http";

// A API responde em inglês para desenvolvedores; a interface mostra textos próprios,
// escolhidos pelo `code`. Assim o idioma da UI não depende do backend.
// Record<ClientErrorCode, string>: se surgir um código novo, isto deixa de compilar.
const MESSAGES: Record<ClientErrorCode, string> = {
  VALIDATION_ERROR: "Some fields are invalid. Please review them and try again.",
  INVALID_JSON: "The request was malformed. Please try again.",
  PAYLOAD_TOO_LARGE: "That is too much text. Please shorten it.",
  NOT_FOUND: "This page does not exist.",
  POLL_NOT_FOUND: "This poll does not exist or has expired.",
  POLL_CLOSED: "This poll is closed and no longer accepts votes.",
  INVALID_OPTION: "That option is not part of this poll.",
  ALREADY_VOTED: "You have already voted on this poll.",
  FORBIDDEN: "You are not allowed to do that.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
  NETWORK_ERROR: "Could not reach the server. Check your connection and try again.",
  TIMEOUT: "The server took too long to answer. Please try again.",
};

export function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return MESSAGES.INTERNAL_ERROR;
  if (err.code === "RATE_LIMITED" && err.retryAfterSeconds) {
    const s = err.retryAfterSeconds;
    return `Too many attempts. Please try again in ${s} ${s === 1 ? "second" : "seconds"}.`;
  }
  return MESSAGES[err.code];
}
