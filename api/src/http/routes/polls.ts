import { type RequestHandler, Router } from "express";
import { PollNotFoundError } from "../../domain/errors.js";
import type { PollService } from "../../services/poll-service.js";
import { createPollSchema, pollIdSchema, voteSchema } from "../schemas.js";

// Um ID fora do formato não tem como existir: respondemos 404, como para um ID
// bem formado que não está na memória. O cliente não precisa saber a diferença.
function parsePollId(raw: string): string {
  const result = pollIdSchema.safeParse(raw);
  if (!result.success) throw new PollNotFoundError(raw);
  return result.data;
}

// Os handlers são "finos": validam a entrada, chamam o service e escolhem o status.
// Qualquer erro lançado aqui (ZodError, AppError...) vai para o error-handler.
// Record<string, string>: um middleware genérico deixaria os tipos de req.params "largos"
// (string | string[]) e o TypeScript perderia o `id: string` que ele deduz do caminho.
type Limit = RequestHandler<Record<string, string>>;

export interface PollRouteLimits {
  create: Limit;
  vote: Limit;
}

export function pollsRouter(service: PollService, limits: PollRouteLimits): Router {
  const router = Router();

  router.get("/polls", (_req, res) => {
    res.json(service.listFeatured());
  });

  // O limitador entra ANTES do handler: se ele barrar, o handler nem roda.
  router.post("/polls", limits.create, (req, res) => {
    const input = createPollSchema.parse(req.body);
    res.status(201).json(service.create(input));
  });

  router.get("/polls/:id", (req, res) => {
    res.json(service.get(parsePollId(req.params.id)));
  });

  router.post("/polls/:id/votes", limits.vote, (req, res) => {
    const pollId = parsePollId(req.params.id);
    const input = voteSchema.parse(req.body);
    res.json(service.vote(pollId, input));
  });

  router.post("/polls/:id/close", (req, res) => {
    const pollId = parsePollId(req.params.id);
    res.json(service.close(pollId, req.get("X-Admin-Token")));
  });

  return router;
}
