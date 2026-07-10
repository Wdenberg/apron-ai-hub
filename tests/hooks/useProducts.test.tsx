import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { supabaseMock } from "../setup";
import { makeWrapper } from "../helpers/queryWrapper";
import { useUpsertProduct, useToggleProductActive } from "@/hooks/useProducts";
import { qk } from "@/lib/queryKeys";

describe("useProducts hooks", () => {
  beforeEach(() => supabaseMock.reset());

  it("useUpsertProduct invalidates products cache", async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useUpsertProduct(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        row: { store_id: "s", name: "n", description: null, price: 1, stock: 1, category: null, active: true, photo_url: null },
      });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.products.all });
  });

  it("useToggleProductActive invalidates products cache", async () => {
    const { Wrapper, qc } = makeWrapper();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useToggleProductActive(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "p1", active: false });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.products.all });
  });
});