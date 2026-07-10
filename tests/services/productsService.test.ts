import { describe, it, expect, beforeEach } from "vitest";
import { supabaseMock } from "../setup";
import {
  listProducts,
  listAvailableProducts,
  setProductActive,
  upsertProduct,
} from "@/services/productsService";

describe("productsService", () => {
  beforeEach(() => supabaseMock.reset());

  it("listAvailableProducts filters active + stock>0", async () => {
    supabaseMock.setData([]);
    await listAvailableProducts("s1");
    const methods = supabaseMock.calls.map((c) => c.method);
    expect(methods).toContain("eq");
    expect(methods).toContain("gt");
  });

  it("listProducts filters by store_id", async () => {
    supabaseMock.setData([{ id: "p" }]);
    const out = await listProducts("s1");
    expect(out).toEqual([{ id: "p" }]);
  });

  it("upsertProduct inserts when no id", async () => {
    await upsertProduct({
      store_id: "s", name: "n", description: null, price: 1, stock: 1,
      category: null, active: true, photo_url: null,
    });
    expect(supabaseMock.calls.some((c) => c.method === "insert")).toBe(true);
  });

  it("upsertProduct updates when id provided", async () => {
    await upsertProduct({
      store_id: "s", name: "n", description: null, price: 1, stock: 1,
      category: null, active: true, photo_url: null,
    }, "prod-1");
    expect(supabaseMock.calls.some((c) => c.method === "update")).toBe(true);
  });

  it("setProductActive updates active column", async () => {
    await setProductActive("p1", false);
    const upd = supabaseMock.calls.find((c) => c.method === "update");
    expect(upd?.args?.[0]).toEqual({ active: false });
  });
});