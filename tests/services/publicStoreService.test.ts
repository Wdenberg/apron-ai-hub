import { describe, it, expect, beforeEach } from "vitest";
import { supabaseMock } from "../setup";
import {
  getPublicStore,
  listPublicProducts,
  createPublicOrder,
} from "@/services/publicStoreService";

describe("publicStoreService", () => {
  beforeEach(() => supabaseMock.reset());

  it("getPublicStore returns first element", async () => {
    supabaseMock.setData([{ id: "s", slug: "loja" }]);
    const out = await getPublicStore("loja");
    expect(out?.slug).toBe("loja");
  });

  it("getPublicStore returns null when no data", async () => {
    supabaseMock.setData(null);
    expect(await getPublicStore("x")).toBeNull();
  });

  it("listPublicProducts forwards slug to rpc", async () => {
    supabaseMock.setData([]);
    await listPublicProducts("loja");
    expect(supabaseMock.supabase.rpc).toHaveBeenCalledWith(
      "list_public_products",
      { _slug: "loja" },
    );
  });

  it("createPublicOrder returns first row from rpc array", async () => {
    supabaseMock.setData([{ id: "o1", order_number: 42 }]);
    const out = await createPublicOrder({
      storeId: "s",
      customerName: "N",
      customerWhatsapp: "21999990000",
      notes: null,
      items: [{ product_id: "p", quantity: 1 }],
      customerUserId: null,
    });
    expect(out).toEqual({ id: "o1", order_number: 42 });
  });

  it("createPublicOrder throws on rpc error", async () => {
    supabaseMock.setError({ message: "closed" });
    await expect(
      createPublicOrder({
        storeId: "s", customerName: "N", customerWhatsapp: "21999990000",
        notes: null, items: [], customerUserId: null,
      }),
    ).rejects.toBeTruthy();
  });
});