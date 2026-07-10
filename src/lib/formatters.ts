import { parsePhoneNumberFromString, AsYouType } from "libphonenumber-js";

/**
 * Formata um telefone brasileiro no padrão `(DD) NNNNN-NNNN` (móvel) ou
 * `(DD) NNNN-NNNN` (fixo). Aceita entradas com/sem DDI, espaços, hífens
 * e parênteses.
 *
 * Exemplos aceitos:
 *  - "81988553542"
 *  - "81 98855 3542"
 *  - "+55 81 98855-3542"
 *  - "(81)988553542"
 *
 * Retorna a string original quando não é possível interpretar o número.
 */
export function formatPhoneBR(input: string | null | undefined): string {
  if (!input) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  const parsed = parsePhoneNumberFromString(raw, "BR");
  if (parsed && parsed.isValid() && parsed.country === "BR") {
    return parsed.formatNational(); // ex.: "(81) 98855-3542"
  }

  // Fallback: usa apenas os dígitos nacionais e formata progressivamente.
  const digits = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digits.length < 10) return raw;
  return new AsYouType("BR").input(digits);
}

/** Retorna apenas os dígitos E.164 (sem `+`) de um telefone BR. */
export function normalizePhoneDigits(input: string | null | undefined): string {
  if (!input) return "";
  const parsed = parsePhoneNumberFromString(String(input), "BR");
  if (parsed && parsed.isValid()) return parsed.number.replace(/^\+/, "");
  return String(input).replace(/\D/g, "");
}

/**
 * Normaliza nomes próprios: primeira letra de cada palavra em maiúscula,
 * preservando preposições/artigos em minúsculas quando não são a primeira
 * palavra. Preserva hifens e apóstrofos (ex.: "d'Ávila", "Saint-Exupéry").
 */
const LOWERCASE_PARTICLES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "du",
  "del",
  "della",
  "van",
  "von",
  "der",
  "la",
  "le",
  "y",
]);

function capitalizeToken(token: string): string {
  if (!token) return token;
  // Trata sub-tokens separados por hífen ou apóstrofo mantendo o separador.
  return token
    .split(/([-'’])/)
    .map((part) => {
      if (part === "-" || part === "'" || part === "’") return part;
      if (!part) return part;
      return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1).toLocaleLowerCase("pt-BR");
    })
    .join("");
}

export function formatProperName(input: string | null | undefined): string {
  if (!input) return "";
  const cleaned = String(input).trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const words = cleaned.split(" ");
  return words
    .map((word, idx) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (idx !== 0 && idx !== words.length - 1 && LOWERCASE_PARTICLES.has(lower)) {
        return lower;
      }
      return capitalizeToken(word);
    })
    .join(" ");
}