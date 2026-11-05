import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../app/App";

// Renderiza o app inteiro (com rotas reais) começando numa URL.
// MemoryRouter guarda a URL em memória: não existe barra de endereço no jsdom.
// strict: true imita o `npm run dev`, em que o StrictMode monta, desmonta e remonta
// cada componente — e, com isso, cancela a primeira requisição de cada efeito.
export function renderApp(path: string, { strict = false } = {}) {
  const app = (
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{app}</StrictMode> : app);
}
