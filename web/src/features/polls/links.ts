// Links de uma enquete. O token de admin viaja no FRAGMENTO (#admin=...): o navegador
// nunca envia o fragmento ao servidor, então ele não aparece em logs nem no Referer.

// base64url (o formato que a API gera), com teto de tamanho: lixo na URL não vai pro storage.
const TOKEN_PATTERN = /^[\w-]{1,128}$/;

/** Link público, para votar. */
export function pollUrl(pollId: string): string {
  return `${window.location.origin}/p/${encodeURIComponent(pollId)}`;
}

/** Link secreto de admin: quem tem este link pode encerrar a enquete. */
export function adminUrl(pollId: string, token: string): string {
  return `${pollUrl(pollId)}#admin=${encodeURIComponent(token)}`;
}

/** Lê o token de um fragmento como "#admin=abc". Devolve undefined se não houver ou for inválido. */
export function adminTokenFromHash(hash: string): string | undefined {
  // URLSearchParams entende "a=1&b=2" e já decodifica os valores.
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("admin");
  return token && TOKEN_PATTERN.test(token) ? token : undefined;
}
