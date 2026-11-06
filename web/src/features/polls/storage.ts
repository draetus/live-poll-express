// Tudo que o navegador lembra entre visitas, guardado no localStorage.
// localStorage pode falhar (modo privado em alguns navegadores, cota cheia, bloqueado
// pelo usuário): toda leitura e escrita tem try/catch, e o app segue funcionando.

const PREFIX = "live-poll:";
const KEYS = {
  voterId: `${PREFIX}voter-id`,
  votes: `${PREFIX}votes`,
  adminTokens: `${PREFIX}admin-tokens`,
} as const;

/** optionId null = a API disse que este navegador já votou, mas não sabemos em quê. */
export interface StoredVote {
  optionId: string | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem storage: o app funciona, só não lembra entre visitas.
  }
}

// Se o storage não funcionar, o ID vale pelo menos enquanto a aba estiver aberta.
let memoryVoterId: string | undefined;

export function getVoterId(): string {
  const stored = read<string | null>(KEYS.voterId, null);
  if (stored) return stored;
  memoryVoterId ??= crypto.randomUUID();
  write(KEYS.voterId, memoryVoterId);
  return memoryVoterId;
}

export function getVote(pollId: string): StoredVote | undefined {
  return read<Record<string, StoredVote>>(KEYS.votes, {})[pollId];
}

export function saveVote(pollId: string, vote: StoredVote): void {
  const votes = read<Record<string, StoredVote>>(KEYS.votes, {});
  write(KEYS.votes, { ...votes, [pollId]: vote });
}

export function getAdminToken(pollId: string): string | undefined {
  return read<Record<string, string>>(KEYS.adminTokens, {})[pollId];
}

export function saveAdminToken(pollId: string, token: string): void {
  const tokens = read<Record<string, string>>(KEYS.adminTokens, {});
  write(KEYS.adminTokens, { ...tokens, [pollId]: token });
}

export function removeAdminToken(pollId: string): void {
  const { [pollId]: _removed, ...rest } = read<Record<string, string>>(KEYS.adminTokens, {});
  write(KEYS.adminTokens, rest);
}
