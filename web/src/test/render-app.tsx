import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, type NavigateFunction, useNavigate } from "react-router";
import { AppRoutes } from "../app/App";
import { RealtimeProvider } from "../app/RealtimeProvider";
import { RealtimeClient } from "../lib/realtime-client";
import { fakeSocketFactory } from "./fake-websocket";

// Renderiza o app inteiro (com rotas reais) começando numa URL.
// MemoryRouter guarda a URL em memória: não existe barra de endereço no jsdom.
// O WebSocket é falso: o teste controla a "rede" pelo `sockets` devolvido.
// strict: true imita o `npm run dev`, em que o StrictMode monta, desmonta e remonta
// cada componente — e, com isso, cancela a primeira requisição de cada efeito.
export function renderApp(path: string, { strict = false } = {}) {
  const sockets = fakeSocketFactory();
  const realtime = new RealtimeClient({
    url: "ws://test/ws",
    createSocket: sockets.createSocket,
    random: () => 1,
  });

  // Componente "espião" que só guarda a função navigate do React Router,
  // para o teste mudar de URL como se o usuário usasse o botão voltar/avançar.
  let navigateFn: NavigateFunction | undefined;
  function CaptureNavigate() {
    navigateFn = useNavigate();
    return null;
  }

  const app = (
    <MemoryRouter initialEntries={[path]}>
      <CaptureNavigate />
      <RealtimeProvider client={realtime}>
        <AppRoutes />
      </RealtimeProvider>
    </MemoryRouter>
  );
  const result = render(strict ? <StrictMode>{app}</StrictMode> : app);

  return {
    ...result,
    sockets,
    realtime,
    navigate(to: string) {
      act(() => {
        void navigateFn?.(to);
      });
    },
  };
}
