/**
 * WhatsApp integration — link-only strategy (no official API, no tokens, no webhooks).
 *
 * All customer↔lojista handoff goes through the public wa.me deep link with
 * a pre-filled message. This module is the ONLY place that formats the URL
 * and the order message, so a future switch to the official Cloud API (or a
 * server-side dispatcher) is a single-file change — callers keep using
 * `openWhatsAppOrder(...)`.
 */
import { formatBRL } from "@/lib/format";

export type WhatsAppOrderItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

export type WhatsAppOrderPayload = {
  storeName: string;
  storePhone: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  items: WhatsAppOrderItem[];
  total: number;
  notes?: string | null;
};

/** Normalize to digits-only with Brazil country code (55). */
export function normalizeBRPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/** Build the wa.me deep link — works on mobile app and WhatsApp Web. */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizeBRPhone(phone)}?text=${encodeURIComponent(message)}`;
}

/** Human-readable order message, pt-BR. */
export function buildOrderMessage(p: WhatsAppOrderPayload): string {
  const lines = p.items
    .map((i) => `• ${i.quantity}x ${i.name} — ${formatBRL(i.unit_price * i.quantity)}`)
    .join("\n");
  const parts = [
    `*Pedido #${p.orderNumber}* — ${p.storeName}`,
    "",
    "*Itens:*",
    lines,
    "",
    `*Total:* ${formatBRL(p.total)}`,
    "",
    `*Cliente:* ${p.customerName}`,
    `*WhatsApp:* ${p.customerPhone}`,
  ];
  if (p.notes && p.notes.trim()) {
    parts.push("", `*Observações:* ${p.notes.trim()}`);
  }
  return parts.join("\n");
}

/** Open WhatsApp (new tab) with the pre-filled order message. */
export function openWhatsAppOrder(p: WhatsAppOrderPayload): void {
  const url = buildWhatsAppUrl(p.storePhone, buildOrderMessage(p));
  window.open(url, "_blank", "noopener,noreferrer");
}
