import { describe, it, expect } from "vitest";
import { qk } from "@/lib/queryKeys";

describe("qk registry", () => {
  it("returns stable string-array keys", () => {
    expect(qk.products.byStore("s1")).toEqual(["products", "s1"]);
    expect(qk.dashboard.byStore("s1", 30)).toEqual(["dashboard", "s1", 30]);
    expect(qk.admin.storeDetail("s1")).toEqual(["admin", "store", "s1"]);
  });

  it("normalizes null/undefined identifiers", () => {
    expect(qk.products.byStore(undefined)).toEqual(["products", null]);
    expect(qk.customers.byStore(null)).toEqual(["customers", null]);
  });

  it("admin.stores composes filter tuple", () => {
    expect(qk.admin.stores({ status: "active" })).toEqual([
      "admin", "stores", "active", "", "",
    ]);
    expect(qk.admin.stores()).toEqual(["admin", "stores", "", "", ""]);
  });
});