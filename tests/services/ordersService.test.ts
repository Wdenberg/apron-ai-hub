import { describe, it, expect, beforeEach } from "vitest";
import { supabaseMock } from "../setup";
import {
  listActiveOrders,
  updateOrder,
  createQuickSale,
} from "@/services/ordersService";

describe("ordersService", () => {
  beforeEach(() => supabaseMock.reset());

  it("listActiveOrders excludes canceled orders", async () => {
    supabaseMock.setData([{ id: "o1" }]);
    await listActiveOrders("store-1");
    const neq = supabaseMock.calls.find((c) => c.method === "neq");
    expect(neq?.args).toEqual(["status", "cancelado"]);
  });

  it("updateOrder throws when supabase returns error", async () => {
    supabaseMock.setError({ message: "denied" });
    await expect(updateOrder("o1", { status: "entregue" })).rejects.toBeTruthy();
  });

  it("createQuickSale forwards params to rpc", async () => {
    supabaseMock.setData([{ id: "o1", order_number: 1, total: 20 }]);
    const out = await createQuickSale({
      storeId: "s",
      customerName: "N",
      customerWhatsapp: "21999990000",
      productId: "p",
      quantity: 2,
      payment: "dinheiro" as never,
    });
    expect(out).toEqual({ id: "o1", order_number: 1, total: 20 });
    expect(supabaseMock.supabase.rpc).toHaveBeenCalledWith(
      "create_quick_sale",
      expect.objectContaining({ _store_id: "s", _quantity: 2 }),
    );
  });
});