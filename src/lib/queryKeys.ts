import type { QueryClient } from "@tanstack/react-query";

/**
 * Centralized query key registry.
 *
 * Single source of truth for React Query keys and invalidations.
 * Never use string-literal keys in hooks/components — always import `qk`.
 *
 * Legitimate direct-Supabase exceptions (do not migrate):
 * - `src/integrations/supabase/*` (auto-generated)
 * - `src/routes/_authenticated/route.tsx` and `src/routes/admin/route.tsx`
 *   (integration-managed auth gates)
 * - `src/hooks/use-session.ts`, `src/hooks/use-is-admin.ts` (session hooks)
 */
export const qk = {
  auth: {
    user: ["auth-user"] as const,
    session: ["session"] as const,
  },
  store: {
    mine: ["my-store"] as const,
    full: ["my-store-full"] as const,
    subscription: ["my-store-subscription"] as const,
    exists: ["my-store-exists"] as const,
    productsCount: (id?: string | null) =>
      ["products-count", id ?? null] as const,
  },
  products: {
    all: ["products"] as const,
    active: ["products-active"] as const,
    byStore: (id?: string | null) => ["products", id ?? null] as const,
    activeByStore: (id?: string | null) =>
      ["products-active", id ?? null] as const,
  },
  orders: {
    all: ["orders"] as const,
    byStore: (id?: string | null) => ["orders", id ?? null] as const,
    quickSalesAll: ["quick-sales"] as const,
    quickSales: (id?: string | null, days?: number) =>
      ["quick-sales", id ?? null, days ?? null] as const,
  },
  customers: {
    all: ["customers"] as const,
    byStore: (id?: string | null) => ["customers", id ?? null] as const,
    orders: (id?: string | null) => ["customer-orders", id ?? null] as const,
  },
  profile: {
    all: ["my-profile"] as const,
    mine: (uid?: string | null) => ["my-profile", uid ?? null] as const,
    basic: (uid?: string | null) => ["profile", uid ?? null] as const,
  },
  myOrders: (uid?: string | null) => ["my-orders", uid ?? null] as const,
  dashboard: {
    all: ["dashboard"] as const,
    byStore: (storeId?: string | null, days?: number) =>
      ["dashboard", storeId ?? null, days ?? null] as const,
  },
  admin: {
    overview: ["admin", "overview"] as const,
    stores: (
      filters?: { status?: string; health?: string; search?: string },
    ) =>
      [
        "admin",
        "stores",
        filters?.status ?? "",
        filters?.health ?? "",
        filters?.search ?? "",
      ] as const,
    storesAll: ["admin", "stores"] as const,
    storeDetail: (id?: string | null) => ["admin", "store", id ?? null] as const,
    team: ["admin", "team"] as const,
    campaigns: ["admin", "campaigns"] as const,
    segment: (s: string) => ["admin", "segment", s] as const,
    trialMetrics: (w: number) => ["admin", "trial-metrics", w] as const,
    recovery: ["admin", "recovery"] as const,
  },
} as const;

export const invalidate = {
  products: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.products.all }),
  productsActive: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.products.active }),
  orders: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.orders.all }),
  quickSales: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.orders.quickSalesAll }),
  customers: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.customers.all }),
  dashboard: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.dashboard.all }),
  profile: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.profile.all }),
  storeFull: (qc: QueryClient) => {
    qc.invalidateQueries({ queryKey: qk.store.full });
    qc.invalidateQueries({ queryKey: qk.store.mine });
  },
  adminStores: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.admin.storesAll }),
  adminStore: (qc: QueryClient, id: string) =>
    qc.invalidateQueries({ queryKey: qk.admin.storeDetail(id) }),
  adminTeam: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.admin.team }),
  adminCampaigns: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: qk.admin.campaigns }),
};