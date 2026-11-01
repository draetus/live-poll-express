import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import type { ApiErrorBody, ErrorCode } from "../../../../shared/api.js";
import { AppError, RouteNotFoundError } from "../../domain/errors.js";
import type { Logger } from "../../lib/logger.js";

function errorBody(
  code: ErrorCode,
  message: string,
  details?: ApiErrorBody["error"]["details"],
): ApiErrorBody {
  return { error: details ? { code, message, details } : { code, message } };
}

// Erros do express.json() (pacote body-parser) vêm com `type` e `status`.
interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    typeof err.type === "string" &&
    "status" in err &&
    typeof err.status === "number"
  );
}

// Registrado DEPOIS de todas as rotas: só chega aqui quem nenhuma rota atendeu.
// Em vez de responder, entrega um erro ao errorHandler: assim TODA resposta de erro
// sai de um lugar só, sempre no mesmo formato.
export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new RouteNotFoundError(req.method, req.path));
  };
}

// O Express reconhece um middleware de erro pelos QUATRO parâmetros (err, req, res, next):
// com três, ele o trataria como um middleware comum e nunca passaria o erro para cá.
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, next) => {
    // Se a resposta já começou a ser enviada, não dá para trocar o status:
    // delegamos ao handler padrão do Express, que encerra a conexão.
    if (res.headersSent) return next(err);

    if (err instanceof z.ZodError) {
      const details = err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      res.status(400).json(errorBody("VALIDATION_ERROR", "Invalid request data", details));
      return;
    }

    if (err instanceof AppError) {
      res.status(err.status).json(errorBody(err.code, err.message));
      return;
    }

    if (isBodyParserError(err)) {
      if (err.type === "entity.too.large") {
        res.status(413).json(errorBody("PAYLOAD_TOO_LARGE", "Request body is too large"));
        return;
      }
      if (err.status < 500) {
        res.status(400).json(errorBody("INVALID_JSON", "Request body is not valid JSON"));
        return;
      }
    }

    // Inesperado: log COMPLETO no servidor, mensagem GENÉRICA para o cliente
    // (detalhes internos, como stack trace, ajudariam um atacante).
    logger.error({ err, method: req.method, url: req.originalUrl }, "unhandled error");
    res.status(500).json(errorBody("INTERNAL_ERROR", "Something went wrong"));
  };
}
