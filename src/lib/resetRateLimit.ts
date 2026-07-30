// Client-side throttle for password-reset e-mails.
// Complements Supabase's own auth e-mail rate limit: it gives the user clear
// feedback and blocks obvious repeat-clicking from this browser.
export const RESET_COOLDOWN_MS = 60_000; // min interval between sends
export const RESET_WINDOW_MS = 15 * 60_000; // sliding window
export const RESET_MAX_ATTEMPTS = 3; // attempts allowed per window
export const RESET_BLOCK_MS = 15 * 60_000; // temporary block duration

const KEY = "pp_reset_attempts_v1";

type State = { attempts: number[]; blockedUntil?: number };

function read(): State {
  if (typeof window === "undefined") return { attempts: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { attempts: [] };
    const parsed = JSON.parse(raw) as State;
    return { attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [], blockedUntil: parsed.blockedUntil };
  } catch {
    return { attempts: [] };
  }
}

function write(state: State) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — throttle degrades to no-op */
  }
}

export type RateLimitStatus =
  | { allowed: true }
  | { allowed: false; reason: "cooldown" | "blocked"; retryInMs: number };

export function checkResetRateLimit(now = Date.now()): RateLimitStatus {
  const state = read();
  if (state.blockedUntil && state.blockedUntil > now) {
    return { allowed: false, reason: "blocked", retryInMs: state.blockedUntil - now };
  }
  const recent = state.attempts.filter((t) => now - t < RESET_WINDOW_MS);
  const last = recent[recent.length - 1];
  if (last !== undefined && now - last < RESET_COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown", retryInMs: RESET_COOLDOWN_MS - (now - last) };
  }
  if (recent.length >= RESET_MAX_ATTEMPTS) {
    write({ attempts: recent, blockedUntil: now + RESET_BLOCK_MS });
    return { allowed: false, reason: "blocked", retryInMs: RESET_BLOCK_MS };
  }
  return { allowed: true };
}

export function registerResetAttempt(now = Date.now()) {
  const state = read();
  const recent = state.attempts.filter((t) => now - t < RESET_WINDOW_MS);
  recent.push(now);
  const blockedUntil = recent.length >= RESET_MAX_ATTEMPTS ? now + RESET_BLOCK_MS : undefined;
  write({ attempts: recent, blockedUntil });
}

export function clearResetRateLimit() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function formatRetryDelay(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return sec ? `${min}min ${sec}s` : `${min}min`;
}
