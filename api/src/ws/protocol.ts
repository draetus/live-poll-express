import { z } from "zod";
import type { ClientMessage } from "../../../shared/ws.js";

// discriminatedUnion: o Zod olha primeiro o campo `type` e só então valida o resto
// com o schema certo. As mensagens de erro ficam mais claras que num union comum.
// pollId aceita qualquer texto curto: um ID inexistente (ou malformado) vira
// POLL_NOT_FOUND no subscribe, igual ao 404 da API REST.
const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), pollId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("unsubscribe"), pollId: z.string().min(1).max(64) }),
]) satisfies z.ZodType<ClientMessage>;

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; reason: string };

// Função pura: recebe o texto cru e diz se é uma mensagem válida do protocolo.
// Nunca lança exceção: quem chama decide como responder ao erro.
export function parseClientMessage(text: string, isBinary: boolean): ParseResult {
  if (isBinary) return { ok: false, reason: "Binary messages are not supported" };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "Message is not valid JSON" };
  }

  const result = clientMessageSchema.safeParse(json);
  if (!result.success) return { ok: false, reason: "Unknown or malformed message" };
  return { ok: true, message: result.data };
}
