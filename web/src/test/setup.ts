import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// A Testing Library só desmonta os componentes sozinha quando o Vitest roda com
// `globals: true`. Como importamos tudo explicitamente, fazemos a limpeza aqui:
// sem isso, o que um teste renderizou "vaza" para o próximo.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
