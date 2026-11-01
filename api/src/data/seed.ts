import { z } from "zod";
import { buildOptions, type Poll } from "../domain/poll.js";
import { createPollSchema, pollIdSchema } from "../http/schemas.js";
import { generateAdminToken } from "../lib/ids.js";

// O seed obedece às MESMAS regras de uma enquete criada pela API, mais um ID fixo.
// ID fixo = o link de uma enquete em destaque continua válido depois de um restart.
const seedSchema = z
  .array(createPollSchema.extend({ id: pollIdSchema }))
  .refine(
    (polls) => new Set(polls.map((p) => p.id)).size === polls.length,
    "Seed ids must be unique",
  );

// Valida no boot: se alguém editar o seed.json errado, o servidor nem sobe,
// com uma mensagem que diz exatamente o campo inválido.
export function parseSeed(raw: unknown, now: Date): Poll[] {
  const result = seedSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid seed data:\n${z.prettifyError(result.error)}`);
  }

  return result.data.map((entry) => ({
    id: entry.id,
    question: entry.question,
    options: buildOptions(entry.options),
    voters: new Set<string>(),
    // Token aleatório que ninguém recebe: enquetes de destaque não podem ser encerradas.
    adminToken: generateAdminToken(),
    closed: false,
    createdAt: now,
    isSeed: true,
  }));
}
