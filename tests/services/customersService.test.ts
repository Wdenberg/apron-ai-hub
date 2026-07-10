import { describe, it, expect, beforeEach } from "vitest";
import { supabaseMock } from "../setup";
import {
  listStoreCustomers,
  deleteCustomer,
  updateCustomer,
} from "@/services/customersService";

describe("customersService", () => {
  beforeEach(() => supabaseMock.reset());

  it("listStoreCustomers calls list_store_customers rpc", async () => {
    supabaseMock.setData([{ id: "c1" }]);
    const out = await listStoreCustomers("s1");
    expect(out).toEqual([{ id: "c1" }]);
    expect(supabaseMock.supabase.rpc).toHaveBeenCalledWith(
      "list_store_customers",
      { _store_id: "s1" },
    );
  });

  it("deleteCustomer throws on error", async () => {
    supabaseMock.setError({ message: "nope" });
    await expect(deleteCustomer("c1")).rejects.toBeTruthy();
  });

  it("updateCustomer sends patch", async () => {
    await updateCustomer("c1", { name: "N", whatsapp: "21999990000" });
    const upd = supabaseMock.calls.find((c) => c.method === "update");
    expect(upd?.args?.[0]).toEqual({ name: "N", whatsapp: "21999990000" });
  });
});