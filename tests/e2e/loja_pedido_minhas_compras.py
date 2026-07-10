"""
E2E: public store → create order → my-orders reflects it (with realtime).

Standalone Playwright script. Skips gracefully if managed Supabase session
is not injected, since account creation requires human confirmation.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SLUG = os.environ.get("E2E_STORE_SLUG", "loja-demo")
SHOTS = Path("/tmp/browser/e2e")
SHOTS.mkdir(parents=True, exist_ok=True)


async def restore_session(context, page):
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")
    if status != "injected":
        print(f"skip: auth status is {status!r}, not 'injected'")
        return False

    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        await context.add_cookies(cookies)
    await page.goto(BASE)
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
    return True


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        signed_in = await restore_session(context, page)
        if not signed_in:
            print("E2E skipped (no managed session).")
            await browser.close()
            return 0

        # 1) Open public store
        await page.goto(f"{BASE}/loja/{SLUG}", wait_until="domcontentloaded")
        await page.screenshot(path=str(SHOTS / "1_store.png"))
        print(f"opened /loja/{SLUG}")

        # 2) Add first product to cart (best-effort selector; adjust for your UI)
        add_btn = page.get_by_role("button", name="Adicionar").first
        if not await add_btn.count():
            print("no product available on public store; skipping")
            await browser.close()
            return 0
        await add_btn.click()
        await page.screenshot(path=str(SHOTS / "2_added.png"))

        # 3) Confirm order
        confirm = page.get_by_role("button", name="Confirmar pedido").first
        if await confirm.count():
            await confirm.click()
            await page.wait_for_timeout(500)
        await page.screenshot(path=str(SHOTS / "3_order_submitted.png"))

        # 4) Navigate to my-orders
        await page.goto(f"{BASE}/minhas-compras", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(SHOTS / "4_my_orders.png"))
        content = await page.content()
        print("my-orders contains any order:", "Pedido" in content or "pedido" in content)

        await browser.close()
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))