import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { supabaseMock } from "../setup";
import { makeWrapper } from "../helpers/queryWrapper";
import { useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";
import { qk } from "@/lib/queryKeys";

describe("useCustomers hooks", () => {
  beforeEach(() => supabaseMock.reset());

  it("useCustomers fetches when storeId is set", async () => {
    supabaseMock.setData([{ id: "c1", name: "N" }]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCustomers("s1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", name: "N" }]);
  });

  it("useCustomers is disabled without storeId", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCustomers(null), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useDeleteCustomer invalidates customers cache", async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync("c1");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.customers.all });
  });
});