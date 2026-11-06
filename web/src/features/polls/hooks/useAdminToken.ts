import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { adminTokenFromHash } from "../links";
import { getAdminToken, removeAdminToken, saveAdminToken } from "../storage";

// O token de admin de uma enquete vem de dois lugares:
// - do localStorage (quem criou a enquete neste navegador);
// - do link de admin (/p/:id#admin=token), aberto em outro navegador ou aparelho.
export function useAdminToken(pollId: string) {
  const location = useLocation();
  const navigate = useNavigate();
  // Já na primeira renderização: o painel de admin aparece sem "piscar".
  const [token, setToken] = useState(
    () => adminTokenFromHash(location.hash) ?? getAdminToken(pollId),
  );

  useEffect(() => {
    const fromLink = adminTokenFromHash(location.hash);
    if (!fromLink) return;
    saveAdminToken(pollId, fromLink);
    setToken(fromLink);
    // Tira o fragmento da barra de endereço (replace: sem criar entrada no histórico),
    // para o token não ficar visível, não sair em print nem ir parar num link copiado.
    // Usamos o navigate do React Router (que chama history.replaceState por baixo)
    // para o roteador também saber que a URL mudou.
    navigate({ pathname: location.pathname, search: location.search }, { replace: true });
  }, [pollId, location.hash, location.pathname, location.search, navigate]);

  // A API recusou o token (403): ele não serve mais, então esquecemos.
  // `rejected` permite à página explicar por que o painel de admin sumiu.
  const [rejected, setRejected] = useState(false);
  const reject = useCallback(() => {
    removeAdminToken(pollId);
    setToken(undefined);
    setRejected(true);
  }, [pollId]);

  return { token, rejected, reject };
}
