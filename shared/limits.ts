// Limites de validação compartilhados.
// O back usa nos schemas Zod; o front usa no formulário (maxLength, botões, etc.).
// Regra de ouro do shared/: nenhum import de pacote, só TypeScript puro.

export const LIMITS = {
  QUESTION_MIN: 3,
  QUESTION_MAX: 200,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 6,
  OPTION_TEXT_MAX: 80,
} as const;
