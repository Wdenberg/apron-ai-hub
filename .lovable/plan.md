
# Fase 3 — Painel Administrativo + Roles

## Papéis (roles) da aplicação

Três papéis, todos na tabela existente `user_roles` (enum `app_role`). Um mesmo usuário pode acumular papéis (ex.: lojista que também é admin), mas na prática cada tela usa um papel de referência.

- **admin** — sócios da ProntoPede. Acesso ao Painel Admin em `/admin/*`.
- **owner** (lojista) — já existe. Mantém o painel em `/_authenticated/*`.
- **user** (cliente final) — novo, **opcional**. Cliente pode pedir sem conta (fluxo atual segue funcionando); se quiser hitórico próprio, faz login com Google ou Nome+WhatsApp.

Adiciono os valores `admin` e `user` ao enum e regras de invitação/self-signup para cada um.

## 3.1 Cliente final (role `user`) — opt-in

**Comportamento:**
- Cardápio público continua permitindo checkout sem login (nome + WhatsApp), sem regressão.
- Na tela de finalizar pedido: botão "Entrar para acompanhar meus pedidos" (Google OU código SMS/WhatsApp). Se logado, os campos nome/WhatsApp vêm pré-preenchidos e o pedido é associado ao `auth.uid()`.
- Nova rota pública `/minhas-compras`: lista pedidos do cliente logado em todas as lojas, com status atual.

**Backend:**
- Coluna `orders.customer_user_id uuid NULL` (referência lógica ao `auth.users`).
- RPC `create_public_order` aceita `_customer_user_id` opcional e o grava no pedido.
- Nova política de leitura para `orders` e `order_items`: `TO authenticated USING (customer_user_id = auth.uid())` — cliente vê só o próprio.
- Trigger no signup grava role `user` por padrão quando o cadastro vem por `/loja/*` (via metadata `signup_source=customer`); quando vem por `/auth` mantém o comportamento atual (`owner`).

**Login sem Google (Nome + Telefone):**
- Uso do Supabase Auth **Phone OTP** (SMS ou WhatsApp) — o próprio Supabase já suporta phone auth. Se o provedor SMS não estiver contratado, degrada para "somente Google" com aviso claro. Peço confirmação antes de habilitar SMS pago.

## 3.2 Painel Admin

### Rota e gate
- Layout novo `src/routes/_admin/route.tsx` (`ssr: false`, `beforeLoad` verifica `has_role(auth.uid(), 'admin')` via RPC — se falhar, redirect para `/`).
- Rotas filhas: `/_admin/dashboard`, `/_admin/lojistas`, `/_admin/lojistas/$id`, `/_admin/financeiro`, `/_admin/trial`, `/_admin/assinaturas`, `/_admin/campanhas`.
- Sidebar dedicada do admin (shadcn `Sidebar`) — separada da sidebar do lojista.

### 3.2.1 Dashboard geral
KPIs em cards:
- Total de cadastrados, ativos, em teste, pendentes, bloqueados, cancelados (por `stores.subscription_status`).
- Novos cadastros: hoje, 7 dias, 30 dias.
- **Financeiro:** MRR (soma de assinaturas ativas × R$ 29,90), receita hoje/semana/mês/ano (soma de `payments` confirmados via webhook Stripe — nova tabela `payments`), receita prevista (assinaturas ativas × 29,90), inadimplência (contagem/valor de `past_due`).

Tudo alimentado por uma única server function `getAdminOverview` (agrega em SQL, retorna DTO enxuto).

### 3.2.2 Lista de lojistas + filtros
Tabela paginada em `/_admin/lojistas` com colunas: nome, e-mail do dono, status, dias restantes de teste, último acesso, saúde, MRR contribuído, ações. Filtros: status, saúde, "sem acesso 7+ dias", busca por nome/e-mail/slug.

### 3.2.3 Detalhe do lojista `/_admin/lojistas/$id`
- Ficha da empresa (dados do `stores`), status atual, dias de teste restantes, último acesso, indicador de saúde.
- Timeline: cadastro, início do teste, conversões de status, comunicações enviadas, motivo de desistência.
- Ações do admin (com registro em `admin_actions`):
  - Alterar `subscription_status` manualmente (com motivo).
  - Estender trial (`trial_ends_at`).
  - Bloquear/desbloquear.
  - Adicionar nota interna.

### 3.2.4 Trial e recuperação
Rota `/_admin/trial`:
- Cards de conversão (% que virou ativo) e desistência (% que expirou sem assinar), janela: 30/60/90 dias.
- Lista "não-assinantes pós-teste" (status `trial_expired` ou `canceled`) com: nome, WhatsApp do dono, dias desde expiração, motivo (se registrado).
- Botão **"Abrir WhatsApp"** por lojista → `wa.me/<whatsapp-dono>?text=<template-edítavel>`.
- Botão **"Registrar motivo"** → modal com combo de motivos padronizados (preço, complexidade, mudou de ramo, não deu certo, outro) + campo livre. Persistido em `churn_reasons`.
- Sub-relatório "Motivos de desistência" com contagem por motivo (barras).

### 3.2.5 Gestão de assinaturas e comunicação
Rota `/_admin/assinaturas`: mesma tabela filtrada por assinatura + ação em massa de alterar status (com auditoria).

Rota `/_admin/campanhas`:
- Wizard: escolher segmento (teste, ativos, inadimplentes, cancelados, custom) → escrever mensagem (templates com variáveis `{{nome_loja}}`, `{{dias_restantes}}`) → preview → gerar lista `wa.me` (um link por lojista, mensagem já preenchida).
- Registrar campanha em `communications` (segmento, mensagem, quantidade). Ao clicar em cada `wa.me`, marca `communications_recipients.opened_at`.
- Histórico de campanhas na mesma tela.

### 3.2.6 Saúde do lojista (regras automáticas)
Função SQL `store_health(store_id)` retorna `green|yellow|red`:
- **verde:** `subscription_status='active'` E último pedido nos últimos 7 dias.
- **amarelo:** `active` sem pedido em 7–30 dias, OU `trial` com ≤3 dias restantes.
- **vermelho:** `past_due`, `blocked`, `canceled`, OU sem acesso (login) há 30+ dias.
Usada em toda a UI admin. Calculada por view/materialized view para performance.

### 3.2.7 Admin convida admin
- Primeiro admin: seed em migração com o **e-mail dos sócios** (pedirei os e-mails após a aprovação do plano).
- Tela `/_admin/equipe`: admin logado insere e-mail → RPC `invite_admin(email)` que, se o usuário já existe, insere `user_roles(role='admin')`; se não, grava um "convite pendente" (tabela `admin_invites`) e um trigger em `auth.users` promove no signup se o e-mail bater.
- RPC `invite_admin` protegida por `has_role(auth.uid(),'admin')`.

## Backend novo (uma migração)

Tabelas/campos:
- `app_role` enum: adicionar `admin` (já existe `owner`), adicionar `user`.
- `orders.customer_user_id uuid NULL` + índice + política de leitura por dono do pedido.
- `stores.last_login_at timestamptz` (atualizado por trigger em `auth.users` `after update of last_sign_in_at`).
- `payments` (id, store_id, stripe_invoice_id UNIQUE, amount_cents, status, paid_at, created_at) — populada pelo webhook Stripe.
- `churn_reasons` (id, store_id, reason enum, note, created_by admin_id, created_at).
- `admin_actions` (id, admin_id, store_id, action, payload jsonb, created_at) — auditoria.
- `admin_notes` (id, store_id, admin_id, note, created_at).
- `admin_invites` (id, email UNIQUE, invited_by, created_at, accepted_at).
- `communications` (id, admin_id, segment, message_template, recipient_count, created_at).
- `communications_recipients` (id, communication_id, store_id, opened_at NULL).

Todas com GRANT + RLS: leitura/escrita apenas por `has_role(auth.uid(),'admin')`, exceto:
- `orders.customer_user_id`: cliente lê o próprio.
- `payments`: lojista lê os seus.

Webhook Stripe (`/api/public/webhooks/stripe`) grava em `payments` e atualiza `subscription_status`.

## Frontend novo

Rotas (dot-notation em `src/routes/`):
```
_admin.route.tsx
_admin.dashboard.tsx
_admin.lojistas.tsx
_admin.lojistas.$id.tsx
_admin.financeiro.tsx
_admin.trial.tsx
_admin.assinaturas.tsx
_admin.campanhas.tsx
_admin.equipe.tsx
minhas-compras.tsx
```

Componentes: `AdminSidebar`, `HealthBadge`, `KpiCard`, `StoreRow`, `CampaignWizard`, `WaButton`.

Todas as leituras via `createServerFn` + `requireSupabaseAuth` (que já valida o bearer) + verificação de role dentro do handler (`has_role`). Nenhum admin lê Stripe IDs no front — só os dados agregados.

## Ordem de entrega

1. Migração: enum, colunas, tabelas, RPCs, views, políticas, trigger `last_login_at`.
2. Layout `_admin` + gate por role + sidebar + `/admin/dashboard` funcional.
3. Lista + detalhe do lojista + ações auditadas.
4. Trial/recuperação + churn reasons.
5. Campanhas WhatsApp + histórico.
6. Equipe (convites de admin) + seed dos sócios.
7. Cliente final (role `user`): coluna `customer_user_id`, login opcional na loja, `/minhas-compras`.
8. Webhook Stripe → tabela `payments` → financeiro real (substitui estimativa).

## Detalhes técnicos

- Novo helper `requireAdmin` empilhado sobre `requireSupabaseAuth` para as server fns admin.
- Views materializadas para KPIs pesados (`admin_overview_daily`), refresh via `pg_cron` a cada 5 min.
- `wa.me` reutiliza `whatsappLink()` em `src/lib/format.ts`.
- Zod para todo input (mensagens, motivos, filtros).
- Recharts para gráficos (já disponível).

## Fora deste escopo (para depois)

- Push/e-mail em massa.
- API real do WhatsApp Business.
- Dashboard do próprio cliente final além de "meus pedidos".
- Suporte a multi-loja por lojista.

## Perguntas que faço na hora do build

- E-mails dos sócios para o seed do primeiro admin.
- Confirmação de habilitar Phone OTP no Supabase (custo do provedor SMS) — caso contrário, cliente final loga só com Google.
