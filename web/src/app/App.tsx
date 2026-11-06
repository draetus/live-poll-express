import { BrowserRouter, Route, Routes } from "react-router";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PollPage } from "../pages/PollPage";
import { PresentPage } from "../pages/PresentPage";
import { Layout } from "./Layout";
import { RealtimeProvider } from "./RealtimeProvider";

// Separado do <App> para os testes poderem trocar o BrowserRouter por um MemoryRouter.
export function AppRoutes() {
  return (
    <Routes>
      {/* Rota de layout: sem `path`, só envolve as filhas com cabeçalho e rodapé */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/p/:pollId" element={<PollPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* Modo apresentação: tela cheia, fora do layout */}
      <Route path="/p/:pollId/present" element={<PresentPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      {/* Uma conexão WebSocket por aba, disponível para qualquer página */}
      <RealtimeProvider>
        <AppRoutes />
      </RealtimeProvider>
    </BrowserRouter>
  );
}
