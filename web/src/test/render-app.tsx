import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import {
  type Location,
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from "react-router";
import { AppRoutes } from "../app/App";
import { RealtimeProvider } from "../app/RealtimeProvider";
import { ServerStatusProvider } from "../app/ServerStatusProvider";
import { RealtimeClient } from "../lib/realtime-client";
import { fakeSocketFactory } from "./fake-websocket";

// Renderiza o app inteiro (com rotas reais) começando numa URL.
// MemoryRouter guarda a URL em memória: não existe barra de endereço no jsdom.
// O WebSocket é falso: o teste controla a "rede" pelo `sockets` devolvido.
// strict: true imita o `npm run dev`, em que o StrictMode monta, desmonta e remonta
// cada componente — e, com isso, cancela a primeira requisição de cada efeito.
// checkServer: por padrão o servidor já está "online" (sem ping no /health).
// Com true, o ping roda de verdade contra o fetch mockado: é o que os testes de cold start usam.
interface RenderAppOptions {
  strict?: boolean;
  checkServer?: boolean;
}

export function renderApp(
  path: string,
  { strict = false, checkServer = false }: RenderAppOptions = {},
) {
  const sockets = fakeSocketFactory();
  const realtime = new RealtimeClient({
    url: "ws://test/ws",
    createSocket: sockets.createSocket,
    random: () => 1,
  });

  // Componente "espião" que guarda a função navigate e a URL atual do React Router:
  // o teste pode mudar de URL (como o botão voltar/avançar) e conferir onde está.
  let navigateFn: NavigateFunction | undefined;
  let currentLocation: Location | undefined;
  function CaptureNavigate() {
    navigateFn = useNavigate();
    currentLocation = useLocation();
    return null;
  }

  const app = (
    <MemoryRouter initialEntries={[path]}>
      <CaptureNavigate />
      <ServerStatusProvider status={checkServer ? undefined : "online"}>
        <RealtimeProvider client={realtime}>
          <AppRoutes />
        </RealtimeProvider>
      </ServerStatusProvider>
    </MemoryRouter>
  );
  const result = render(strict ? <StrictMode>{app}</StrictMode> : app);

  return {
    ...result,
    sockets,
    realtime,
    location: () => currentLocation,
    navigate(to: string) {
      act(() => {
        void navigateFn?.(to);
      });
    },
  };
}
