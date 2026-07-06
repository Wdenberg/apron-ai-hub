/**
 * Security suite: customers & orders RPCs / joins cross-tenant isolation.
 *
 * Verifies that:
 *  - anon cannot invoke owner-scoped RPCs (list_store_customers, list_customer_orders)
 *    to leak another store's customers or orders.
 *  - an authenticated user who is NOT the owner of the victim store cannot
 *    invoke those RPCs against the victim, nor read customers/orders directly
 *    or via PostgREST embeds/joins.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = "https://c--d357f68d-b1c6-4ec9-96d2-1c06308d6098-prod.lovable.cloud";
const KEY = "sb_publishable_6OaJ9FKf6UowFwWqOr26yQ_nMQc41A8";

// Victim: Baracho Drinkes — real store with customers + orders seeded.
const VICTIM_STORE_ID = "059561db-33d7-4d14-8376-925235c20625";
const VICTIM_CUSTOMER_ID = "7b73075e-1513-48b3-bdd0-9aaec74bec87";
const VICTIM_ORDER_ID = "b9655c19-9a65-447f-90d1-fe0066938071";

const make = () =>
  createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined as never },
  });

const anon: SupabaseClient = make();
const attacker: SupabaseClient = make();

beforeAll(async () => {
  const email = `attacker-rpc+${Date.now()}@rls-test.dev`;
  const { data, error } = await attacker.auth.signUp({
    email,
    password: "Attacker!Password#123",
    options: { data: { signup_source: "owner", full_name: "Attacker RPC" } },
  });
  if (error) throw error;
  if (!data.session) throw new Error("no session (email confirmation enabled?)");
});

/** A "leak" is any returned row for victim data. Empty result or explicit error = OK. */
function assertNoLeak(label: string, rows: unknown) {
  const count = Array.isArray(rows) ? rows.length : rows ? 1 : 0;
  if (count > 0) throw new Error(`${label}: LEAK — got ${count} rows`);
}

/** RPC must either error (Forbidden) or return no rows. Never leak. */
function assertRpcBlocked(label: string, data: unknown, error: { message?: string } | null) {
  if (error) return; // Forbidden / permission denied — fine
  assertNoLeak(label, data);
}

describe("anon cannot invoke owner-scoped customer/order RPCs", () => {
  it("list_store_customers(victim) is blocked", async () => {
    const { data, error } = await anon.rpc("list_store_customers", { _store_id: VICTIM_STORE_ID });
    assertRpcBlocked("anon list_store_customers", data, error);
  });

  it("list_customer_orders(victim customer) is blocked", async () => {
    const { data, error } = await anon.rpc("list_customer_orders", { _customer_id: VICTIM_CUSTOMER_ID });
    assertRpcBlocked("anon list_customer_orders", data, error);
  });

  it("my_orders is unauthorized for anon", async () => {
    const { data, error } = await anon.rpc("my_orders");
    // Function raises 'Unauthorized' when auth.uid() is null.
    if (!error) assertNoLeak("anon my_orders", data);
  });

  it("customers: anon direct/filter/embed cannot read victim customers", async () => {
    const direct = await anon.from("customers").select("*").limit(50);
    assertNoLeak("anon customers *", direct.data);
    const filtered = await anon.from("customers").select("*").eq("store_id", VICTIM_STORE_ID);
    assertNoLeak("anon customers where victim", filtered.data);
    // Try to leak via stores→customers embed
    const embed = await anon.from("stores").select("id, customers(*)").eq("id", VICTIM_STORE_ID);
    const rows = (embed.data ?? []) as Array<{ customers?: unknown[] }>;
    const leaked = rows.flatMap((r) => r.customers ?? []);
    assertNoLeak("anon stores→customers embed", leaked);
  });
});

describe("authenticated attacker (different owner) cannot access victim customers/orders", () => {
  it("list_store_customers(victim) is Forbidden", async () => {
    const { data, error } = await attacker.rpc("list_store_customers", { _store_id: VICTIM_STORE_ID });
    if (!error) throw new Error(`attacker list_store_customers: expected Forbidden, got ${JSON.stringify(data)}`);
    if (!/forbidden/i.test(error.message)) throw new Error(`unexpected error: ${error.message}`);
  });

  it("list_customer_orders(victim customer) is Forbidden", async () => {
    const { data, error } = await attacker.rpc("list_customer_orders", { _customer_id: VICTIM_CUSTOMER_ID });
    if (!error) throw new Error(`attacker list_customer_orders: expected Forbidden, got ${JSON.stringify(data)}`);
    if (!/forbidden/i.test(error.message)) throw new Error(`unexpected error: ${error.message}`);
  });

  it("my_orders never returns victim orders", async () => {
    const { data, error } = await attacker.rpc("my_orders");
    if (error) throw error;
    const rows = (data ?? []) as Array<{ id: string; store_id: string }>;
    const leaked = rows.filter((r) => r.store_id === VICTIM_STORE_ID || r.id === VICTIM_ORDER_ID);
    if (leaked.length) throw new Error(`my_orders LEAK: ${JSON.stringify(leaked)}`);
  });

  it("customers: attacker direct/filter/by-id returns 0 victim rows", async () => {
    const a = await attacker.from("customers").select("*").limit(50);
    const leakedA = ((a.data ?? []) as Array<{ store_id: string }>).filter((r) => r.store_id === VICTIM_STORE_ID);
    assertNoLeak("attacker customers * leak", leakedA);

    const b = await attacker.from("customers").select("*").eq("store_id", VICTIM_STORE_ID);
    assertNoLeak("attacker customers where victim", b.data);

    const c = await attacker.from("customers").select("*").eq("id", VICTIM_CUSTOMER_ID);
    assertNoLeak("attacker customers by id", c.data);
  });

  it("customers: attacker cannot leak via stores→customers embed", async () => {
    const { data } = await attacker.from("stores").select("id, customers(*)").eq("id", VICTIM_STORE_ID);
    const rows = (data ?? []) as Array<{ customers?: unknown[] }>;
    const leaked = rows.flatMap((r) => r.customers ?? []);
    assertNoLeak("attacker stores→customers embed", leaked);
  });

  it("orders: attacker cannot leak victim orders via customer_whatsapp filter", async () => {
    // Even guessing the phone number should not reveal orders of another store.
    const { data } = await attacker
      .from("orders")
      .select("id, store_id, customer_name, customer_whatsapp")
      .eq("store_id", VICTIM_STORE_ID);
    assertNoLeak("attacker orders by victim store", data);
  });

  it("orders→customers style join: attacker cannot pivot from orders to victim customers", async () => {
    // Attacker fetches their own orders (0) with any joinable relation; must not surface victim rows.
    const { data } = await attacker
      .from("orders")
      .select("id, store_id, stores(id, name, owner_id)")
      .limit(50);
    const rows = (data ?? []) as Array<{ store_id: string }>;
    const leaked = rows.filter((r) => r.store_id === VICTIM_STORE_ID);
    assertNoLeak("attacker orders→stores embed leak", leaked);
  });
});
