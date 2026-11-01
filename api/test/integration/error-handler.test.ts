import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiErrorBody } from "../../../shared/api.js";
import { errorHandler } from "../../src/http/middlewares/error-handler.js";
import { createLogger } from "../../src/lib/logger.js";

// Um app Express mínimo, só com rotas que falham de propósito + o nosso errorHandler.
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.get("/sync-crash", () => {
    throw new Error("connection string: postgres://user:secret@db");
  });
  // Express 5: a promise rejeitada vai sozinha para o errorHandler (sem try/catch).
  app.get("/async-crash", async () => {
    await Promise.resolve();
    throw new Error("async secret detail");
  });
  app.use(errorHandler(createLogger({ LOG_LEVEL: "silent", NODE_ENV: "test" })));

  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  await once(server, "close");
});

describe("errorHandler with unexpected errors", () => {
  it.each(["/sync-crash", "/async-crash"])(
    "%s returns 500 INTERNAL_ERROR without leaking details",
    async (path) => {
      const res = await fetch(`${baseUrl}${path}`);
      const text = await res.text();

      expect(res.status).toBe(500);
      expect((JSON.parse(text) as ApiErrorBody).error).toEqual({
        code: "INTERNAL_ERROR",
        message: "Something went wrong",
      });
      expect(text).not.toContain("secret");
    },
  );
});
