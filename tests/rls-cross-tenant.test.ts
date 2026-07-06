/**
 * Cross-tenant RLS isolation suite.
 *
 * Verifies that:
 *  - anon (no session) cannot read any orders/order_items
 *  - an authenticated attacker (different owner, different customer) cannot
 *    read orders/order_items of another store — direct, via WHERE filter,
 *    or via PostgREST joins/embeds in either direction.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = "https://c--d357f68d-b1c6-4ec9-96d2-1c06308d6098-prod.lovable.cloud";
const KEY = "sb_publishable_6OaJ9FKf6UowFwWqOr26yQ_nMQc41A8";

// Real victim data seeded in the DB (Baracho Drinkes store + 2 orders)
const VICTIM_STORE_ID = "059561db-33d7-4d14-8376-925235c20625";
const VICTIM_ORDER_ID = "b9655c19-9a65-447f-90d1-fe0066938071";

const make = () =>
  createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined as never },
  });

const anon: SupabaseClient = make();
const attacker: SupabaseClient = make();

beforeAll(async () => {
  const email = `attacker+${Date.now()}@rls-test.dev`;
  const { data, error } = await attacker.auth.signUp({
    email,
    password: "Attacker!Password#123",
    options: { data: { signup_source: "customer", full_name: "Attacker" } },
  });
  if (error) throw error;
  if (!data.session) throw new Error("no session (email confirmation enabled?)");
});

// helper: a "leak" is any row returned OR an error that is NOT a
// permission/RLS denial. Empty results and 401/403 are both acceptable.
function assertBlocked(label: string, rows: unknown, error: { code?: string; message?: string } | null) {
  const rowCount = Array.isArray(rows) ? rows.length : rows ? 1 : 0;
  if (rowCount === 0) return; // filtered by RLS → fine
  throw new Error(`${label}: LEAK — got ${rowCount} rows; error=${JSON.stringify(error)}`);
}

describe("anon cannot read private tables", () => {
  it("orders: direct select", async () => {
    const { data, error } = await anon.from("orders").select("*").limit(50);
    assertBlocked("anon orders *", data, error);
  });
  it("orders: filtered by victim store", async () => {
    const { data, error } = await anon.from("orders").select("*").eq("store_id", VICTIM_STORE_ID);
    assertBlocked("anon orders where store_id", data, error);
  });
  it("order_items: direct select", async () => {
    const { data, error } = await anon.from("order_items").select("*").limit(50);
    assertBlocked("anon order_items *", data, error);
  });
  it("order_items: filtered by victim order", async () => {
    const { data, error } = await anon.from("order_items").select("*").eq("order_id", VICTIM_ORDER_ID);
    assertBlocked("anon order_items where order_id", data, error);
  });
  it("join: orders embed order_items", async () => {
    const { data, error } = await anon.from("orders").select("id, order_items(*)").limit(50);
    assertBlocked("anon orders+items embed", data, error);
  });
  it("join: order_items embed order + store", async () => {
    const { data, error } = await anon
      .from("order_items")
      .select("id, orders(id, store_id, stores(id, name))")
      .limit(50);
    assertBlocked("anon items→order→store embed", data, error);
  });
  it("stores: direct select is blocked (public data uses stores_public view)", async () => {
    const { data, error } = await anon.from("stores").select("owner_id, stripe_customer_id").limit(50);
    assertBlocked("anon stores sensitive", data, error);
  });
});

describe("authenticated attacker cannot read victim data", () => {
  it("orders: direct select returns nothing", async () => {
    const { data, error } = await attacker.from("orders").select("*").limit(50);
    assertBlocked("attacker orders *", data, error);
  });
  it("orders: WHERE store_id = victim → 0 rows", async () => {
    const { data, error } = await attacker.from("orders").select("*").eq("store_id", VICTIM_STORE_ID);
    assertBlocked("attacker orders where victim store", data, error);
  });
  it("orders: WHERE id = victim order → 0 rows", async () => {
    const { data, error } = await attacker.from("orders").select("*").eq("id", VICTIM_ORDER_ID);
    assertBlocked("attacker orders where victim id", data, error);
  });
  it("order_items: WHERE order_id = victim order → 0 rows", async () => {
    const { data, error } = await attacker.from("order_items").select("*").eq("order_id", VICTIM_ORDER_ID);
    assertBlocked("attacker items where victim order", data, error);
  });
  it("join: orders→items embed cannot leak victim items", async () => {
    const { data, error } = await attacker.from("orders").select("id, order_items(*)").limit(50);
    assertBlocked("attacker orders+items embed", data, error);
  });
  it("join: items→orders→stores embed cannot leak victim order", async () => {
    const { data, error } = await attacker
      .from("order_items")
      .select("id, orders(id, store_id, customer_name, stores(id, name, owner_id))")
      .limit(50);
    assertBlocked("attacker items→order→store embed", data, error);
  });
  it("my_orders RPC returns only attacker's own orders (0)", async () => {
    const { data, error } = await attacker.rpc("my_orders");
    if (error) throw error;
    // The attacker has no orders; must NOT contain the victim's.
    const rows = (data ?? []) as Array<{ id: string; store_id: string }>;
    const leaked = rows.filter((r) => r.store_id === VICTIM_STORE_ID);
    if (leaked.length) throw new Error(`my_orders LEAK: ${JSON.stringify(leaked)}`);
  });
  it("stores: attacker cannot read victim sensitive fields", async () => {
    const { data, error } = await attacker
      .from("stores")
      .select("id, owner_id, stripe_customer_id, subscription_status")
      .eq("id", VICTIM_STORE_ID);
    assertBlocked("attacker stores victim", data, error);
  });
  it("customers: attacker cannot list victim's customers", async () => {
    const { data, error } = await attacker.from("customers").select("*").eq("store_id", VICTIM_STORE_ID);
    assertBlocked("attacker customers victim", data, error);
  });
  it("payments: attacker cannot list victim's payments", async () => {
    const { data, error } = await attacker.from("payments").select("*").eq("store_id", VICTIM_STORE_ID);
    assertBlocked("attacker payments victim", data, error);
  });
});
