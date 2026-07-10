# Refatoração arquitetural — Services + Hooks em toda a aplicação

## Objetivo
Mover todas as chamadas diretas a Supabase (`from`, `rpc`, `auth`, `storage`, `channel`) e todo uso de `useQuery`/`useMutation` de dentro dos componentes para duas camadas dedicadas, sem alterar comportamento, layout ou regras de negócio.

## Escopo mapeado (arquivos que hoje contêm dados/queries)
Rotas de lojista: `dashboard.tsx` (já refatorado), `assinatura.tsx`, `clientes.tsx`, `configuracoes.tsx`, `onboarding.tsx`, `pedidos.tsx`, `perfil.tsx`, `produtos.tsx`, `vendas.tsx`.
Rotas de admin: `admin/dashboard.tsx`, `admin/campanhas.tsx`, `admin/equipe.tsx`, `admin/lojistas.tsx`, `admin/lojistas.$id.tsx`, `admin/trial.tsx`.
Rotas públicas / auth: `auth.tsx`, `entrar.tsx`, `loja.$slug.tsx`, `minhas-compras.tsx`, `routes/__root.tsx`.
Componentes: `AdminShell.tsx`, `AppShell.tsx`, `StoreImage.tsx`.

Fora de escopo (não são componentes / já são infra):
`integrations/supabase/*`, `integrations/lovable/*`, `hooks/use-session.ts`, `hooks/use-is-admin.ts`, `routes/_authenticated/route.tsx`, `routes/admin/route.tsx` — já são hooks/guards de sessão.

## Arquitetura alvo

```text
src/
├── services/
│   ├── dashboardService.ts        (existente)
│   ├── storeService.ts            (stores: meus dados, update, upload logo)
│   ├── productsService.ts         (products CRUD)
│   ├── ordersService.ts           (orders list/update/quick-sale RPC + realtime)
│   ├── customersService.ts        (RPC list_store_customers, list_customer_orders)
│   ├── subscriptionService.ts     (stores billing fields, payments)
│   ├── profileService.ts          (profiles)
│   ├── authService.ts             (signIn/signUp/signOut/OAuth/reset)
│   ├── publicStoreService.ts      (get_public_store, list_public_products, create_public_order)
│   ├── myOrdersService.ts         (RPC my_orders)
│   └── admin/
│       ├── adminStoresService.ts
│       ├── adminOverviewService.ts
│       ├── adminTeamService.ts
│       ├── adminCampaignsService.ts
│       └── adminTrialService.ts
│
└── hooks/
    ├── useDashboard.ts            (existente)
    ├── useStore.ts / useUpdateStore.ts
    ├── useProducts.ts
    ├── useOrders.ts
    ├── useCustomers.ts
    ├── useSubscription.ts
    ├── useProfile.ts
    ├── useAuth.ts
    ├── usePublicStore.ts
    ├── useMyOrders.ts
    └── admin/
        ├── useAdminStores.ts
        ├── useAdminOverview.ts
        ├── useAdminTeam.ts
        ├── useAdminCampaigns.ts
        └── useAdminTrial.ts
```

## Regras invariantes
- Sem mudança de UI, texto, layout, comportamento ou queryKeys existentes.
- Sem alterar SQL/RPCs — apenas mover a chamada.
- Preservar tipagens; sem `as any` novos.
- Reaproveitar tipos gerados em `src/integrations/supabase/types.ts`.
- Realtime (`supabase.channel`) fica em service, exposto como `subscribeXxx(cb)`; hook faz `useEffect` de assinatura como já feito em `useDashboard`.
- Storage uploads (`supabase.storage`) ficam em service; hook expõe `useMutation`.
- `supabase.auth` (login/logout/session) fica em `authService` + `useAuth`. `hooks/use-session.ts` continua sendo a fonte de sessão reativa (mantido).

## Execução — módulo a módulo
Vou entregar em ondas, cada uma com service + hook + refactor de componente + typecheck:

1. Store/profile/subscription (`configuracoes`, `perfil`, `assinatura`, `onboarding`, `AppShell`, `StoreImage`).
2. Products + Orders + Customers + Vendas (`produtos`, `pedidos`, `clientes`, `vendas`).
3. Público + Auth + Minhas compras (`loja.$slug`, `auth`, `entrar`, `minhas-compras`, `__root` limpeza).
4. Admin (`admin/dashboard`, `admin/lojistas`, `admin/lojistas.$id`, `admin/campanhas`, `admin/equipe`, `admin/trial`, `AdminShell`).

Cada onda faz `tsgo` para garantir zero regressão de tipos antes de seguir.

## Detalhes técnicos
- Services são módulos puros: `import { supabase } from "@/integrations/supabase/client"`, funções `async` tipadas retornando dados já desembrulhados (`.data`), lançando em `error` quando aplicável para o hook tratar.
- Hooks: `useQuery({ queryKey, queryFn: () => service.fn(args), enabled })` e `useMutation({ mutationFn, onSuccess: invalidate })`. QueryKeys mantidas idênticas às atuais para não invalidar cache cruzada em outros pontos.
- Realtime: `subscribeXxx(storeId, onChange) => unsubscribe`, consumido em `useEffect` dentro do hook agregador correspondente.
- Não vou tocar em `integrations/supabase/*` (auto-gen/infra) nem nos guards de rota (`_authenticated/route.tsx`, `admin/route.tsx`) que usam `supabase.auth.getUser()` legitimamente como parte do gate.

## Entregável final
Ao concluir, relatório com: componentes refatorados, services criados, hooks criados, estrutura final de pastas, e observações sobre qualquer arquivo intencionalmente não movido (auto-gen ou guards).
