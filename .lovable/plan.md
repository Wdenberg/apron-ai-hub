
# Plano — ProntoPede MVP Fase 1

SaaS multi-tenant para microempreendedores da alimentação: cada empreendedor tem uma loja pública em `/loja/:slug`, um painel autenticado e uma assinatura mensal (R$ 29,90) com 7 dias grátis.

## Identidade visual

- Cor primária: **#e85d32** (terracota), tokens semânticos derivados em `src/styles.css` (oklch).
- Tipografia: **Plus Jakarta Sans** (via `@fontsource/plus-jakarta-sans`).
- Ícones: `lucide-react` (Material Symbols não é padrão do stack; mantém a linguagem visual "clean/warm").
- Cards de alta clareza, whitespace generoso, badges de status coloridos.

## Arquitetura de rotas (TanStack Start)

```text
/                              Landing pública (hero, features, pricing, CTA teste grátis)
/auth                          Login + cadastro (email/senha + Google)
/loja/$slug                    Loja pública do empreendedor (cardápio + carrinho)
/loja/$slug/pedido/$numero     Confirmação de pedido (link WhatsApp pré-formatado)

/_authenticated/
  onboarding                   Wizard pós-cadastro: nome loja, slug, WhatsApp, endereço
  dashboard                    KPIs do dia/semana/mês + pedidos pendentes
  pedidos                      Kanban: Recebido → Preparo → Pronto → Entregue
  produtos                     CRUD produtos + upload de fotos + estoque
  vendas                       Registro rápido de venda presencial (PIX/Cartão/Dinheiro)
  clientes                     CRM simples (nome, WhatsApp, recorrência)
  relatorios                   Gráficos: receita, ticket médio, formas de pagamento
  configuracoes                Perfil da loja, horários, QR Code, status Aberto/Fechado
  assinatura                   Status trial/ativo + botão Stripe Checkout / Portal
```

Admin (SaaS Governance) fica para a Fase 2 — o MVP prioriza o empreendedor.

## Backend (Lovable Cloud)

Ativar Lovable Cloud. Tabelas principais (todas com RLS + GRANTs, roles em tabela separada):

- `profiles` — dados do usuário (auto-criado no signup)
- `app_role` enum + `user_roles` — `owner`, `admin`
- `stores` — 1:1 com owner: slug, nome, descrição, logo_url, whatsapp, endereço, horários (jsonb), status_aberto, trial_ends_at, subscription_status
- `products` — store_id, nome, preço, estoque, foto_url, ativo, categoria
- `orders` — store_id, numero (seq por loja), cliente_nome, cliente_whatsapp, total, status enum, tipo (`reserva` | `presencial`), pagamento, created_at
- `order_items` — order_id, product_id, qtd, preço_unit
- `customers` — store_id, whatsapp único, nome, total_pedidos, ultimo_pedido_at (derivado via trigger)

Regras-chave:
- Estoque decrementa via trigger `AFTER INSERT ON order_items`; produto com estoque 0 fica `ativo=false`.
- RLS: dono só vê linhas onde `store_id` pertence a `auth.uid()`. Loja pública lê `stores`/`products` via política `TO anon` filtrada por `slug` + `ativo`.
- Storage bucket `store-assets` (público) para logos e fotos de produtos.

## Assinatura (Stripe seamless)

- `enable_stripe_payments` + produto único "ProntoPede Mensal — R$ 29,90".
- Trial de 7 dias no Stripe; webhook em `/api/public/webhooks/stripe` sincroniza `stores.subscription_status`.
- Middleware no `_authenticated`: se `subscription_status` ∈ {`blocked`, `past_due`} redireciona para `/assinatura`.

## Fluxo do pedido (sem API WhatsApp)

1. Cliente monta carrinho na loja pública, informa nome + WhatsApp.
2. Cria `order` com número sequencial, status `recebido`.
3. Página de confirmação mostra `wa.me/<whatsapp-loja>?text=<resumo-encoded>` — cliente clica e envia.
4. Empreendedor avança status no Kanban; muda de coluna com drag ou botão.

## Entregas por incremento (ordem de build)

1. Cloud + Stripe habilitados, schema + RLS + seed de tipos.
2. Landing + `/auth` (email/senha + Google) + onboarding com criação de `store`.
3. Loja pública `/loja/$slug` + fluxo de pedido + WhatsApp link.
4. Painel: dashboard, pedidos (kanban), produtos (CRUD + upload).
5. Vendas presenciais, clientes, relatórios (Recharts).
6. Configurações + QR Code (`qrcode` npm) + toggle Aberto/Fechado.
7. Assinatura: checkout, portal, webhook, gate de trial expirado.

## Detalhes técnicos

- Server functions (`createServerFn` + `requireSupabaseAuth`) para toda escrita autenticada; loja pública usa server publishable client com políticas `TO anon`.
- Uploads via `supabase.storage` no cliente (bucket público).
- Gráficos com `recharts` (já disponível via shadcn/chart).
- QR code gerado client-side com `qrcode.react`.
- Validação com `zod` em todo input (cliente + server).
- Design system: tokens HSL/oklch em `src/styles.css`, variantes shadcn — nada de classes de cor hardcoded.

## Fora de escopo (Fase 2+)

- Painel Admin (MRR, churn, assinantes, health alerts).
- Notificações push, integração real com WhatsApp Business API.
- Múltiplas lojas por usuário, cupons, delivery com rota.
