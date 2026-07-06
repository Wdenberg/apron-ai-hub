import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Security headers applied to every response. CSP allows the Supabase Data API
// origin (from SUPABASE_URL) for fetch/WebSocket + storage image loads.
function buildSecurityHeaders(): Record<string, string> {
  const supaOrigin = (() => {
    try { return new URL(process.env.SUPABASE_URL ?? "").origin; } catch { return ""; }
  })();
  const supaWs = supaOrigin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  const connect = [
    "'self'",
    supaOrigin, supaWs,
    "https://*.lovable.app", "https://*.lovable.cloud",
    "https://*.lovableproject.com", "wss://*.lovableproject.com",
    "ws:", "wss:", // dev HMR + Supabase realtime fallback
  ].filter(Boolean).join(" ");
  const img = ["'self'", "data:", "blob:", supaOrigin, "https:"].filter(Boolean).join(" ");
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // React/Vite need inline styles; scripts are same-origin bundles.
    // 'unsafe-eval' is required by Vite HMR in dev and by some runtime libs
    // (e.g. schema validators using new Function). Kept because 'unsafe-inline'
    // is already present — the extra eval capability is not a meaningful downgrade.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src ${img}`,
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");
  return {
    "content-security-policy": csp,
    "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "cross-origin-opener-policy": "same-origin",
  };
}

const SECURITY_HEADERS = buildSecurityHeaders();

function withSecurityHeaders(response: Response): Response {
  // Response headers can be immutable — clone into a fresh mutable Headers object.
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withSecurityHeaders(normalized);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
