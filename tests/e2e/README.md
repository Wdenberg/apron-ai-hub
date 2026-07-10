# E2E: loja → pedido → minhas-compras

Opt-in Playwright script. Requires the sandbox dev server on
`http://localhost:8080` and either:

- `LOVABLE_BROWSER_AUTH_STATUS=injected` with the managed Supabase session
  vars, OR
- A test store with a public slug and at least one active product with stock.

Run manually:

```bash
bunx playwright test tests/e2e/loja-pedido.spec.ts \
  --config tests/e2e/playwright.config.ts
```

Or execute the standalone script directly with Python:

```bash
python3 tests/e2e/loja_pedido_minhas_compras.py
```

Screenshots are written to `/tmp/browser/e2e/`.

Set `E2E_STORE_SLUG` to override the store slug (default: `loja-demo`).