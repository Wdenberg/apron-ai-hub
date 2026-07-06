import { describe, it, expect } from "vitest";
import {
  buildWhatsAppUrl,
  buildOrderMessage,
  normalizeBRPhone,
  type WhatsAppOrderPayload,
} from "@/lib/whatsapp";

describe("normalizeBRPhone", () => {
  it("keeps only digits", () => {
    expect(normalizeBRPhone("(21) 99999-0000")).toBe("5521999990000");
  });
  it("does not double the country code", () => {
    expect(normalizeBRPhone("+55 21 99999-0000")).toBe("5521999990000");
    expect(normalizeBRPhone("5521999990000")).toBe("5521999990000");
  });
  it("adds 55 when missing", () => {
    expect(normalizeBRPhone("21999990000")).toBe("5521999990000");
  });
  it("strips letters, spaces and punctuation", () => {
    expect(normalizeBRPhone("tel: (21) 9.9999-0000 ramal 1")).toBe("55219999900001");
  });
});

describe("buildWhatsAppUrl", () => {
  it("uses the wa.me deep link (never the official API host)", () => {
    const url = buildWhatsAppUrl("21999990000", "oi");
    expect(url.startsWith("https://wa.me/")).toBe(true);
    expect(url).not.toContain("api.whatsapp.com");
    expect(url).not.toContain("graph.facebook.com");
  });

  it("encodes phone with country code in the path", () => {
    expect(buildWhatsAppUrl("(21) 99999-0000", "oi")).toBe(
      "https://wa.me/5521999990000?text=oi",
    );
  });

  it("percent-encodes spaces (as %20, not '+')", () => {
    const url = buildWhatsAppUrl("21999990000", "hello world");
    expect(url).toContain("text=hello%20world");
    expect(url).not.toContain("text=hello+world");
  });

  it("encodes newlines as %0A", () => {
    const url = buildWhatsAppUrl("21999990000", "linha1\nlinha2");
    expect(url).toContain("text=linha1%0Alinha2");
  });

  it("encodes URL-reserved characters (& = ? # + /)", () => {
    const url = buildWhatsAppUrl("21999990000", "a&b=c?d#e+f/g");
    const text = url.split("?text=")[1];
    expect(text).toBe("a%26b%3Dc%3Fd%23e%2Bf%2Fg");
  });

  it("encodes non-ASCII pt-BR characters (á, ç, ã, emoji)", () => {
    const url = buildWhatsAppUrl("21999990000", "Olá, ação 🎉");
    expect(url).toContain("Ol%C3%A1");
    expect(url).toContain("a%C3%A7%C3%A3o");
    expect(url).toContain("%F0%9F%8E%89"); // 🎉
  });

  it("round-trips through decodeURIComponent", () => {
    const original = "Pedido #12 — Item 1 & Item 2\nTotal: R$ 10,00";
    const url = buildWhatsAppUrl("21999990000", original);
    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toBe(original);
  });
});

const basePayload: WhatsAppOrderPayload = {
  storeName: "Baracho Drinks",
  storePhone: "(21) 99999-0000",
  orderNumber: 42,
  customerName: "João da Silva",
  customerPhone: "(11) 98888-7777",
  items: [
    { name: "Caipirinha", quantity: 2, unit_price: 15 },
    { name: "Coca-Cola 350ml", quantity: 1, unit_price: 7.5 },
  ],
  total: 37.5,
  notes: null,
};

describe("buildOrderMessage", () => {
  it("includes order number and store name in the header", () => {
    const msg = buildOrderMessage(basePayload);
    expect(msg).toContain("*Pedido #42*");
    expect(msg).toContain("Baracho Drinks");
  });

  it("lists every item with quantity, name and line subtotal (BRL)", () => {
    const msg = buildOrderMessage(basePayload);
    expect(msg).toContain("2x Caipirinha");
    expect(msg).toContain("1x Coca-Cola 350ml");
    // 2 × 15 = 30
    expect(msg).toMatch(/2x Caipirinha — R\$\s?30,00/);
    // 1 × 7.5 = 7.50
    expect(msg).toMatch(/1x Coca-Cola 350ml — R\$\s?7,50/);
  });

  it("shows the total formatted in BRL", () => {
    const msg = buildOrderMessage(basePayload);
    expect(msg).toMatch(/\*Total:\* R\$\s?37,50/);
  });

  it("includes customer name and phone", () => {
    const msg = buildOrderMessage(basePayload);
    expect(msg).toContain("*Cliente:* João da Silva");
    expect(msg).toContain("*WhatsApp:* (11) 98888-7777");
  });

  it("omits the notes block when notes is null or empty", () => {
    expect(buildOrderMessage({ ...basePayload, notes: null })).not.toContain("Observações");
    expect(buildOrderMessage({ ...basePayload, notes: "" })).not.toContain("Observações");
    expect(buildOrderMessage({ ...basePayload, notes: "   " })).not.toContain("Observações");
  });

  it("includes and trims notes when provided", () => {
    const msg = buildOrderMessage({ ...basePayload, notes: "  sem cebola  " });
    expect(msg).toContain("*Observações:* sem cebola");
    expect(msg).not.toContain("  sem cebola  ");
  });

  it("survives special characters (emoji, quotes, ampersand) without corruption", () => {
    const msg = buildOrderMessage({
      ...basePayload,
      customerName: 'María "Rocha" & Cia 🎉',
      items: [{ name: "Açaí 500ml <especial>", quantity: 1, unit_price: 20 }],
      notes: "linha1\nlinha2",
    });
    expect(msg).toContain('María "Rocha" & Cia 🎉');
    expect(msg).toContain("Açaí 500ml <especial>");
    expect(msg).toContain("linha1\nlinha2");
  });

  it("produces a URL that round-trips the full order message", () => {
    const msg = buildOrderMessage(basePayload);
    const url = buildWhatsAppUrl(basePayload.storePhone, msg);
    expect(url.startsWith("https://wa.me/5521999990000?text=")).toBe(true);
    const decoded = decodeURIComponent(url.split("?text=")[1]);
    expect(decoded).toBe(msg);
  });
});
