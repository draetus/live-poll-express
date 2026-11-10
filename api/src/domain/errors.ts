import type { ErrorCode } from "../../../shared/api.js";

// Erro "esperado" da aplicação: sabe seu status HTTP e seu código do contrato.
// O middleware de erro transforma qualquer AppError na resposta JSON padrão.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name; // nos logs aparece "PollNotFoundError", não só "Error"
  }
}

export class RouteNotFoundError extends AppError {
  constructor(method: string, path: string) {
    super(404, "NOT_FOUND", `Route ${method} ${path} not found`);
  }
}

export class PollNotFoundError extends AppError {
  constructor(pollId: string) {
    super(404, "POLL_NOT_FOUND", `Poll ${pollId} not found`);
  }
}

export class PollClosedError extends AppError {
  constructor(pollId: string) {
    super(409, "POLL_CLOSED", `Poll ${pollId} is closed`);
  }
}

export class InvalidOptionError extends AppError {
  constructor(optionId: string) {
    super(400, "INVALID_OPTION", `Option ${optionId} does not exist in this poll`);
  }
}

export class AlreadyVotedError extends AppError {
  constructor(pollId: string) {
    super(409, "ALREADY_VOTED", `This voter has already voted on poll ${pollId}`);
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super(403, "FORBIDDEN", "Missing or invalid admin token");
  }
}

export class RateLimitedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, "RATE_LIMITED", `Too many requests, retry in ${retryAfterSeconds} s`);
  }
}
