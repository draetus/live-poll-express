import cors from "cors";
import type { RequestHandler } from "express";

// CORS só vale para chamadas feitas pelo NAVEGADOR (fetch de outro domínio).
// O pacote `cors` cuida dos detalhes chatos: responder ao preflight (OPTIONS),
// devolver Access-Control-Allow-Origin só para origens permitidas e o header Vary.
export function corsMiddleware(allowedOrigins: string[]): RequestHandler {
  return cors({
    origin: allowedOrigins, // array: o pacote ecoa a origem só se ela estiver na lista
    methods: ["GET", "POST"],
    // X-Admin-Token é um header "não simples": força o navegador a fazer preflight
    // e precisa estar liberado aqui, senão o POST /polls/:id/close é bloqueado.
    allowedHeaders: ["Content-Type", "X-Admin-Token"],
    maxAge: 600, // o navegador pode guardar o resultado do preflight por 10 min
  });
}
