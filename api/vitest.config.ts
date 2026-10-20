import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Logs do pino só atrapalham a saída dos testes
    env: { LOG_LEVEL: "silent" },
  },
});
