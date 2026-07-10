import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { supabaseMock } from "../setup";
import { makeWrapper } from "../helpers/queryWrapper";
import { useCreateQuickSale, useUpdateOrder } from "@/hooks/useOrders";
import { qk } from "@/lib/queryKeys";

describe("useOrders hooks", () => {
  beforeEach(() => supabaseMock.reset());

  it("useCreateQuickSale invalidates products, products-active and quick-sales", async () => {
    supabaseMock.setData([{ id: "o", order_number: 1, total: 10 }]);
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useCreateQuickSale(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        storeId: "s", customerName: "N", customerWhatsapp: "21999990000",
        productId: "p", quantity: 1, payment: "dinheiro" as never,
      });
    });
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([qk.orders.quickSalesAll, qk.products.active, qk.products.all]),
    );
  });

  it("useUpdateOrder invalidates orders cache on success", async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpdateOrder(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "o1", status: "entregue" as never });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.orders.all });
  });
});