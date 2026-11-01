import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Sem caracteres ambíguos (0/O/o, 1/l/I): melhor para links ditados ou digitados.
// 8 dígitos + 24 maiúsculas + 24 minúsculas = 56 símbolos.
export const ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
export const POLL_ID_LENGTH = 8; // 56^8 ≈ 9,7 × 10^13 combinações

// Gerada a partir do alfabeto: se ele mudar, a validação da URL acompanha.
export const POLL_ID_PATTERN = new RegExp(`^[${ID_ALPHABET}]{${POLL_ID_LENGTH}}$`);

export function shortId(size = POLL_ID_LENGTH): string {
  let id = "";
  // randomInt (de node:crypto) é criptograficamente seguro e sem viés de módulo,
  // diferente de Math.random(), que é previsível.
  for (let i = 0; i < size; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}

// 24 bytes aleatórios = 192 bits; base64url é seguro para usar em URL (sem + / =).
export function generateAdminToken(): string {
  return randomBytes(24).toString("base64url");
}

// Comparação em tempo constante, contra "timing attack": um `===` comum para no
// primeiro caractere diferente, e medir esse tempo revelaria o token aos poucos.
export function tokensMatch(expected: string, received: string | undefined): boolean {
  if (received === undefined) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  // timingSafeEqual lança erro com tamanhos diferentes, então checamos antes.
  return a.length === b.length && timingSafeEqual(a, b);
}
