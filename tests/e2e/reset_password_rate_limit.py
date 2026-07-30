"""
E2E: /esqueci-senha rate limiting + temporary block.

Covers:
  1. First request is sent (one /auth/v1/recover call).
  2. Immediate resend is throttled by the cooldown (no extra request).
  3. After the max attempts inside the window, the UI shows a temporary
     block message and still sends nothing.

The Supabase recover endpoint is intercepted; no real e-mail is sent.
Run: python3 tests/e2e/reset_password_rate_limit.py
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, Route

BASE = "http://localhost:8080"
SUPABASE_HOST = "c--d357f68d-b1c6-4ec9-96d2-1c06308d6098-prod.lovable.cloud"
SHOTS = Path("/tmp/browser/reset-rate-limit")
SHOTS.mkdir(parents=True, exist_ok=True)

STORAGE_KEY = "pp_reset_attempts_v1"
COOLDOWN_MS = 60_000
MAX_ATTEMPTS = 3


async def install_mocks(context, calls):
    async def handler(route: Route):
        path = urlparse(route.request.url).path
        if path.endswith("/auth/v1/recover"):
            calls.append("recover")
            await route.fulfill(status=200, content_type="application/json", body="{}")
            return
        await route.continue_()

    await context.route(f"https://{SUPABASE_HOST}/**", handler)


async def body_text(page) -> str:
    return (await page.locator("body").inner_text()).lower()


async def main() -> int:
    checks = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        calls: list[str] = []
        await install_mocks(context, calls)
        page = await context.new_page()

        await page.goto(f"{BASE}/esqueci-senha", wait_until="domcontentloaded")
        await page.evaluate(f"window.localStorage.removeItem({json.dumps(STORAGE_KEY)})")

        # 1) first request goes through
        await page.get_by_label("E-mail").fill("lojista@example.com")
        await page.get_by_role("button", name="Enviar link de recuperação").click()
        resend = page.get_by_role("button", name="Reenviar", exact=False)
        await resend.wait_for(state="visible", timeout=10000)
        await page.screenshot(path=str(SHOTS / "1_sent.png"))
        checks.append(("first request sent", calls.count("recover") == 1))

        # 2) immediate resend is throttled
        await resend.click()
        await page.wait_for_timeout(500)
        text = await body_text(page)
        await page.screenshot(path=str(SHOTS / "2_cooldown.png"))
        checks.append(("cooldown message shown", "aguarde" in text))
        checks.append(("resend button disabled during cooldown", await resend.is_disabled()))
        checks.append(("no extra request during cooldown", calls.count("recover") == 1))

        # 3) max attempts inside the window -> temporary block
        now_ms = int(time.time() * 1000)
        attempts = [now_ms - (COOLDOWN_MS * (i + 2)) for i in range(MAX_ATTEMPTS)]
        await page.evaluate(
            "([k, v]) => window.localStorage.setItem(k, v)",
            [STORAGE_KEY, json.dumps({"attempts": sorted(attempts)})],
        )
        await page.reload(wait_until="domcontentloaded")
        await page.get_by_label("E-mail").fill("lojista@example.com")
        await page.get_by_role("button", name="Enviar link de recuperação").click()
        await page.wait_for_timeout(600)
        text = await body_text(page)
        await page.screenshot(path=str(SHOTS / "3_blocked.png"))
        checks.append(("temporary block message shown", "muitas tentativas" in text))
        checks.append(("no request while blocked", calls.count("recover") == 1))
        blocked_until = await page.evaluate(
            "(k) => (JSON.parse(window.localStorage.getItem(k) || '{}').blockedUntil ?? 0)",
            STORAGE_KEY,
        )
        checks.append(("block persisted in storage", blocked_until > now_ms))

        print("recover calls:", calls)
        await browser.close()

    print("\n=== results ===")
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return 1 if any(not ok for _, ok in checks) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
