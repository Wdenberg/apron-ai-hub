import { describe, expect, it } from "vitest";
import { formatPhoneBR, formatProperName, normalizePhoneDigits } from "@/lib/formatters";

describe("formatPhoneBR", () => {
  const expected = "(81) 98855-3542";

  it.each([
    "81988553542",
    "81 98855 3542",
    "+55 81 98855-3542",
    "(81)988553542",
    "(81) 98855-3542",
    "55 81 98855-3542",
  ])("formata %s no padrão nacional", (input) => {
    expect(formatPhoneBR(input)).toBe(expected);
  });

  it("formata telefone fixo", () => {
    expect(formatPhoneBR("1132224444")).toBe("(11) 3222-4444");
  });

  it("retorna string vazia para entrada vazia/nula", () => {
    expect(formatPhoneBR("")).toBe("");
    expect(formatPhoneBR(null)).toBe("");
    expect(formatPhoneBR(undefined)).toBe("");
  });

  it("preserva entrada quando não é interpretável", () => {
    expect(formatPhoneBR("abc")).toBe("abc");
  });
});

describe("normalizePhoneDigits", () => {
  it("retorna E.164 sem +", () => {
    expect(normalizePhoneDigits("+55 81 98855-3542")).toBe("5581988553542");
    expect(normalizePhoneDigits("81988553542")).toBe("5581988553542");
  });
});

describe("formatProperName", () => {
  it("capitaliza nome mantendo preposições em minúsculas", () => {
    expect(formatProperName("wdenberg ramos de barros")).toBe("Wdenberg Ramos de Barros");
  });

  it("normaliza entradas com espaços/casos variados", () => {
    expect(formatProperName("  MARIA   DAS   DORES  ")).toBe("Maria das Dores");
    expect(formatProperName("JOÃO E MARIA DA SILVA")).toBe("João e Maria da Silva");
  });

  it("capitaliza a primeira e a última palavra mesmo se forem partículas", () => {
    expect(formatProperName("de souza")).toBe("De Souza");
    expect(formatProperName("ana de")).toBe("Ana De");
  });

  it("preserva hifens e apóstrofos", () => {
    expect(formatProperName("saint-exupéry")).toBe("Saint-Exupéry");
    expect(formatProperName("d'ávila")).toBe("D'Ávila");
  });

  it("retorna string vazia para entrada vazia/nula", () => {
    expect(formatProperName("")).toBe("");
    expect(formatProperName(null)).toBe("");
    expect(formatProperName(undefined)).toBe("");
  });
});