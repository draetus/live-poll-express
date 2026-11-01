import { z } from "zod";
import type { CreatePollRequest, VoteRequest } from "../../../shared/api.js";
import { LIMITS } from "../../../shared/limits.js";
import { POLL_ID_PATTERN } from "../lib/ids.js";

// `satisfies z.ZodType<T>` é a "cola" entre o Zod (runtime) e o shared/ (tipos):
// se alguém mudar o contrato e esquecer o schema (ou o contrário), o BUILD quebra.

export const createPollSchema = z.object({
  question: z.string().trim().min(LIMITS.QUESTION_MIN).max(LIMITS.QUESTION_MAX),
  options: z
    .array(z.string().trim().min(1).max(LIMITS.OPTION_TEXT_MAX))
    .min(LIMITS.OPTIONS_MIN)
    .max(LIMITS.OPTIONS_MAX)
    .refine(
      // Roda DEPOIS do trim: " Sim" e "sim " contam como repetidas.
      (options) => new Set(options.map((o) => o.toLowerCase())).size === options.length,
      "Options must be unique",
    ),
}) satisfies z.ZodType<CreatePollRequest>;

export const voteSchema = z.object({
  optionId: z.string().min(1).max(16),
  voterId: z.uuid(),
}) satisfies z.ZodType<VoteRequest>;

export const pollIdSchema = z.string().regex(POLL_ID_PATTERN);
