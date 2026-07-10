import { describe, it, expect, beforeEach } from "vitest";
import { supabaseMock } from "../setup";
import {
  getMyStore,
  getOrdersSince,
  getTopItemsSince,
  subscribeToStoreOrders,
} from "@/services/dashboardService";

describe("dashboardService", () => {
  beforeEach(() => supabaseMock.reset());

  it("getMyStore queries the stores table", async () => {
    supabaseMock.setData({ id: "store-1" });
    const store = await getMyStore();
    expect(store).toEqual({ id: "store-1" });
    expect(supabaseMock.supabase.from).toHaveBeenCalledWith("stores");
  });

  it("getOrdersSince filters by store_id and created_at", async () => {
    const rows = [{ total: 10, type: "presencial", status: "entregue", payment_status: "pago", created_at: "2026-01-01" }];
    supabaseMock.setData(rows);
    const out = await getOrdersSince("store-1", "2026-01-01T00:00:00Z");
    expect(out).toEqual(rows);
    const eqCall = supabaseMock.calls.find((c) => c.method === "eq");
    expect(eqCall?.args).toEqual(["store_id", "store-1"]);
    const gteCall = supabaseMock.calls.find((c) => c.method === "gte");
    expect(gteCall?.args).toEqual(["created_at", "2026-01-01T00:00:00Z"]);
  });

  it("getTopItemsSince returns empty when data is null", async () => {
    supabaseMock.setData(null);
    const out = await getTopItemsSince("2026-01-01T00:00:00Z");
    expect(out).toEqual([]);
  });

  it("subscribeToStoreOrders registers a channel and returns unsubscribe", () => {
    const unsubscribe = subscribeToStoreOrders("store-1", () => {});
    expect(supabaseMock.channels).toContain("orders-dashboard-store-1");
    unsubscribe();
    expect(supabaseMock.supabase.removeChannel).toHaveBeenCalled();
  });
});