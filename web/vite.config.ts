import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const REQUIRED_BUILD_ENV = ["VITE_API_URL", "VITE_WS_URL"] as const;

// defineConfig vindo de "vitest/config" aceita tudo do Vite + o bloco `test` do Vitest.
// Na forma de função, recebemos `command` ("serve" no dev/testes, "build" no build).
export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    // Falhar o BUILD é melhor que publicar um site que tenta falar com "localhost":
    // na Vercel, o deploy é recusado e a versão anterior continua no ar.
    const env = loadEnv(mode, import.meta.dirname, "VITE_");
    const missing = REQUIRED_BUILD_ENV.filter((name) => !env[name]);
    if (missing.length > 0) {
      throw new Error(`Missing environment variables for the build: ${missing.join(", ")}`);
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // `import ... from "@shared/api"` → arquivo ../shared/api.ts
      alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
    },
    server: {
      // Por segurança, o dev server só serve arquivos dentro de web/.
      // Liberamos a pasta pai para ele conseguir servir ../shared.
      fs: { allow: [".."] },
    },
    test: {
      environment: "jsdom", // um "navegador de mentira" em Node: document, window, etc.
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["src/test/setup.ts"],
    },
  };
});
