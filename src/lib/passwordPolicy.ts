/**
 * Regras de senha da aplicação (usadas no reset de senha).
 * Mensagens em português, centralizadas para reuso e testes.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export type PasswordRule = {
  id: string;
  label: string;
  test: (v: string) => boolean;
};

export const passwordRules: PasswordRule[] = [
  {
    id: "length",
    label: `Pelo menos ${PASSWORD_MIN} caracteres`,
    test: (v) => v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX,
  },
  { id: "lower", label: "Uma letra minúscula", test: (v) => /[a-z]/.test(v) },
  { id: "upper", label: "Uma letra maiúscula", test: (v) => /[A-Z]/.test(v) },
  { id: "number", label: "Um número", test: (v) => /\d/.test(v) },
  { id: "symbol", label: "Um símbolo (!@#$...)", test: (v) => /[^A-Za-z0-9]/.test(v) },
  { id: "nospace", label: "Sem espaços em branco", test: (v) => v.length > 0 && !/\s/.test(v) },
];

const COMMON_PASSWORDS = [
  "12345678", "123456789", "senha123", "password", "password1", "qwerty123",
  "abc12345", "11111111", "iloveyou", "admin123", "prontopede",
];

export function isCommonPassword(v: string): boolean {
  const s = v.toLowerCase();
  return COMMON_PASSWORDS.some((c) => s === c || s.includes(c));
}

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  failed: PasswordRule[];
  valid: boolean;
  error: string | null;
};

export function evaluatePassword(value: string): PasswordStrength {
  const v = value ?? "";
  const failed = passwordRules.filter((r) => !r.test(v));
  const passedCount = passwordRules.length - failed.length;

  let error: string | null = null;
  if (v.length === 0) error = "Informe a nova senha";
  else if (v.length > PASSWORD_MAX) error = `A senha deve ter no máximo ${PASSWORD_MAX} caracteres`;
  else if (failed.length > 0)
    error = `A senha precisa de: ${failed.map((f) => f.label.toLowerCase()).join(", ")}`;
  else if (isCommonPassword(v))
    error = "Essa senha é muito comum. Escolha uma senha mais difícil de adivinhar.";

  const valid = error === null;
  let score: PasswordStrength["score"];
  if (!valid) score = passedCount <= 2 ? 0 : passedCount <= 4 ? 1 : 2;
  else score = v.length >= 14 ? 4 : 3;

  const labels = ["Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"];
  return { score, label: labels[score], failed, valid, error };
}