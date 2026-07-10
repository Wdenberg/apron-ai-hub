## Objetivo

Consolidar a refatoração arquitetural em quatro frentes: (1) padronizar `queryKeys`/invalidations, (2) auditar chamadas diretas ao Supabase remanescentes em componentes, (3) cobrir services e hooks com testes unitários e (4) adicionar um teste E2E do fluxo público → pedido → minhas-compras.

---

## 1. Centralização de `queryKeys` e invalidations

Criar `src/lib/queryKeys.ts` como fonte única de verdade:

```ts
export const qk = {
  auth: { user: ["auth-user"] as const, session: ["session"] as const },
  store: {
    mine: ["my-store"] as const,
    full: ["my-store-full"] as const,
    subscription: ["my-store-subscription"] as const,
    exists: ["my-store-exists"] as const,
    productsCount: (id?: string) => ["products-count", id] as const,
  },
  products: {
    all: ["products"] as const,
    byStore: (id?: string) => ["products", id] as const,
    active: (id?: string) => ["products-active", id] as const,
  },
  orders: {
    all: ["orders"] as const,
    byStore: (id?: string) => ["orders", id] as const,
    quickSales: (id?: string, days?: number) => ["quick-sales", id, days] as const,
  },
  customers: {
    all: ["customers"] as const,
    byStore: (id?: string) => ["customers", id] as const,
    orders: (id?: string) => ["customer-orders", id] as const,
  },
  profile: {
    mine: (uid?: string) => ["my-profile", uid] as const,
    basic: (uid?: string) => ["profile", uid] as const,
  },
  myOrders: (uid?: string | null) => ["my-orders", uid] as const,
  dashboard: (storeId?: string, days?: number) => ["dashboard", storeId, days] as const,
  admin: {
    overview: ["admin", "overview"] as const,
    stores: (filters?: unknown) => ["admin", "stores", filters] as const,
    storeDetail: (id?: string) => ["admin", "store", id] as const,
    team: ["admin", "team"] as const,
    campaigns: ["admin", "campaigns"] as const,
    segment: (s: string) => ["admin", "segment", s] as const,
    trialMetrics: (w: number) => ["admin", "trial-metrics", w] as const,
    recovery: ["admin", "recovery"] as const,
  },
} as const;

export const invalidators = {
  products: (qc) => qc.invalidateQueries({ queryKey: qk.products.all }),
  orders: (qc) => qc.invalidateQueries({ queryKey: qk.orders.all }),
  // ...
};
```

Atualizar todos os hooks em `src/hooks/**` e `src/hooks/admin/**` para usar `qk.*` — remover strings literais duplicadas. Nenhuma mudança de comportamento; apenas troca de literais por referências tipadas.

---

## 2. Auditoria de chamadas diretas ao Supabase em componentes

Rodar `rg -n "from '@/integrations/supabase/client'" src/components src/routes` e `rg -n "supabase\.(from|rpc|auth|storage|channel)" src/components src/routes` para identificar violações. Para cada ocorrência remanescente:

- Mover para o service correspondente.
- Expor via hook em `src/hooks/**`.
- Substituir no componente.

Documentar exceções legítimas (ex.: `hooks/use-session.ts`, `auth-middleware`, arquivos gerados) num comentário no topo de `queryKeys.ts` ou em `AGENTS.md`.

---

## 3. Testes unitários (Vitest)

Setup: `tests/setup.ts` com mock global de `@/integrations/supabase/client` usando um builder encadeável (`from().select().eq().maybeSingle()` etc.) que retorna dados controlados por teste.

Suítes (cobertura de services + hooks principais):

- `tests/services/dashboardService.test.ts` — `getOrdersSince`, `getTopItemsSince`, filtros de `store_id`.
- `tests/services/ordersService.test.ts` — `createQuickSale` (rpc), `listActiveOrders`, `updateOrder`.
- `tests/services/productsService.test.ts` — `listProducts`, `upsertProduct`, `setProductActive`.
- `tests/services/customersService.test.ts` — `listStoreCustomers`, `deleteCustomer`.
- `tests/services/publicStoreService.test.ts` — `createPublicOrder` (rpc).
- `tests/services/authService.test.ts` — sign in/out/update.

Hooks (com `QueryClientProvider` de teste):

- `tests/hooks/useDashboard.test.ts` — verifica agrupamento por dia/semana/mês, cálculo de `revenueMonthTotal`, `topProduct`.
- `tests/hooks/useOrders.test.ts` — `useCreateQuickSale` invalida `products` e `quick-sales`.
- `tests/hooks/useProducts.test.ts` — invalidação em upsert.
- `tests/hooks/useCustomers.test.ts` — update/delete invalidam `customers`.

Adicionar script `test:unit` em `package.json` se ausente.

---

## 4. Teste E2E (Playwright via shell)

`tests/e2e/loja-pedido-minhas-compras.spec.ts` executado com o dev server já rodando em `localhost:8080`.

Fluxo:

1. Seed via SQL de teste (migration idempotente `tests/e2e/seed.sql` aplicada com `psql`/`supabase--read_query` ou via service role) — cria loja de teste, produto ativo, usuário customer.
2. Login como customer (usa `LOVABLE_BROWSER_SUPABASE_*` se disponível; senão, sign-in via UI).
3. Navegar até `/loja/<slug>`, adicionar produto ao carrinho, confirmar pedido.
4. Verificar toast/confirmação de pedido criado.
5. Navegar para `/minhas-compras` e validar que o pedido aparece.
6. Simular atualização em tempo real: outro contexto (service role) altera `status` do pedido → confirmar que a UI reflete via subscription (aguardar seletor com novo status; timeout curto).
7. Screenshots em cada etapa em `/tmp/browser/e2e/`.

O teste é opt-in (não bloqueia CI se secrets ausentes) — pular com `test.skip` quando `LOVABLE_BROWSER_AUTH_STATUS !== 'injected'`.

---

## Detalhes técnicos

- Sem mudanças em SQL, RLS ou UI.
- `queryKeys.ts` tipado com `as const` para inferência.
- Mocks de Supabase compartilhados em `tests/helpers/supabaseMock.ts`.
- `tsgo --noEmit` + `bunx vitest run` como verificação final.
- Playwright em `tests/e2e/` executado manualmente (`bunx playwright test tests/e2e` ou script dedicado); não integrado ao `vitest`.

---

## Entregáveis

1. `src/lib/queryKeys.ts` + refatoração dos ~14 hooks.
2. Relatório de auditoria (chat) + correções pontuais se encontradas.
3. ~10 arquivos de teste unitário + helpers de mock.
4. 1 spec E2E + seed.
5. Scripts `test:unit` e `test:e2e` em `package.json`.

Confirma para eu executar?