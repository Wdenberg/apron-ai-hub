"""
E2E: /reset-password token validation flows.

Covers: missing token, expired hash error, PKCE error, token_hash "already used",
and implicit-hash success (mocked). Verifies user-facing messages / form.

Runs against the dev server at http://localhost:8080. Supabase responses are
intercepted so no real recovery token is needed.
"""

import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, Route

BASE = "http://localhost:8080"
SUPABASE_HOST = "c--d357f68d-b1c6-4ec9-96d2-1c06308d6098-prod.lovable.cloud"
SHOTS = Path("/tmp/browser/reset-password")
SHOTS.mkdir(parents=True, exist_ok=True)


async def install_supabase_mocks(context, *, verify_error=None, pkce_error=None):
    async def handler(route: Route):
        req = route.request
        url = urlparse(req.url)
        path = url.path
        if path.endswith("/auth/v1/verify") and verify_error:
            await route.fulfill(
                status=verify_error["status"],
                content_type="application/json",
                body=json.dumps(verify_error["body"]),
            )
            return
        if path.endswith("/auth/v1/token") and pkce_error and "grant_type=pkce" in (url.query or ""):
            await route.fulfill(
                status=pkce_error["status"],
                content_type="application/json",
                body=json.dumps(pkce_error["body"]),
            )
            return
        await route.continue_()

    await context.route(f"https://{SUPABASE_HOST}/**", handler)


async def get_visible_text(page) -> str:
    return (await page.locator("body").inner_text()).lower()


async def expect_message(page, needle: str, label: str):
    text = await get_visible_text(page)
    ok = needle.lower() in text
    print(f"  [{'OK' if ok else 'FAIL'}] {label}: expected substring {needle!r}")
    if not ok:
        print("  --- visible text ---")
        print(text[:600])
    return ok


async def scenario_missing_token(context):
    print("scenario: missing token")
    page = await context.new_page()
    await page.goto(f"{BASE}/reset-password", wait_until="domcontentloaded")
    # grace window is 1.2s; wait slightly longer
    await page.wait_for_timeout(2000)
    await page.screenshot(path=str(SHOTS / "1_missing.png"))
    ok = await expect_message(page, "inválido ou expirado", "missing token message")
    await page.close()
    return ok


async def scenario_expired_hash(context):
    print("scenario: expired hash error")
    page = await context.new_page()
    url = (
        f"{BASE}/reset-password"
        "#error=access_denied&error_code=otp_expired"
        "&error_description=Email+link+is+invalid+or+has+expired"
    )
    await page.goto(url, wait_until="domcontentloaded")
    await page.wait_for_timeout(500)
    await page.screenshot(path=str(SHOTS / "2_expired_hash.png"))
    ok = await expect_message(page, "expirou", "expired hash message")
    await page.close()
    return ok


async def scenario_pkce_expired(context):
    print("scenario: PKCE expired token")
    await install_supabase_mocks(
        context,
        pkce_error={
            "status": 400,
            "body": {"error": "invalid_grant", "error_description": "Token has expired or is invalid"},
        },
    )
    page = await context.new_page()
    await page.goto(f"{BASE}/reset-password?code=fake-pkce-code", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    await page.screenshot(path=str(SHOTS / "3_pkce_expired.png"))
    ok = await expect_message(page, "expirou", "PKCE expired message")
    await page.close()
    await context.unroute(f"https://{SUPABASE_HOST}/**")
    return ok


async def scenario_token_hash_used(context):
    print("scenario: token_hash already used")
    await install_supabase_mocks(
        context,
        verify_error={
            "status": 401,
            "body": {"error": "invalid_grant", "error_description": "Token has already been used"},
        },
    )
    page = await context.new_page()
    await page.goto(
        f"{BASE}/reset-password?token_hash=abc123&type=recovery",
        wait_until="domcontentloaded",
    )
    await page.wait_for_timeout(1500)
    await page.screenshot(path=str(SHOTS / "4_token_used.png"))
    ok = await expect_message(page, "já foi utilizado", "token used message")
    await page.close()
    await context.unroute(f"https://{SUPABASE_HOST}/**")
    return ok


async def scenario_implicit_success(context):
    print("scenario: implicit hash success (mocked session)")
    page = await context.new_page()
    # Prime origin so we can write localStorage.
    await page.goto(f"{BASE}/reset-password", wait_until="domcontentloaded")
    storage_key = f"sb-{SUPABASE_HOST.split('.')[0]}-auth-token"
    fake_session = {
        "access_token": "fake-access-token",
        "refresh_token": "fake-refresh-token",
        "expires_in": 3600,
        "expires_at": 9999999999,
        "token_type": "bearer",
        "user": {"id": "00000000-0000-0000-0000-000000000000", "email": "test@example.com"},
    }
    await page.evaluate(
        "(k, v) => window.localStorage.setItem(k, v)",
        [storage_key, json.dumps(fake_session)],
    )
    await page.goto(
        f"{BASE}/reset-password#access_token=fake-access-token&type=recovery",
        wait_until="domcontentloaded",
    )
    await page.wait_for_timeout(2000)
    await page.screenshot(path=str(SHOTS / "5_implicit_success.png"))
    # Form should be visible: look for the password input.
    has_form = await page.locator('input[name="password"]').count() > 0
    print(f"  [{'OK' if has_form else 'FAIL'}] implicit success: password form rendered")
    await page.close()
    return has_form


async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for scenario in (
                scenario_missing_token,
                scenario_expired_hash,
                scenario_pkce_expired,
                scenario_token_hash_used,
                scenario_implicit_success,
            ):
                ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
                try:
                    ok = await scenario(ctx)
                    results.append((scenario.__name__, ok))
                finally:
                    await ctx.close()
        finally:
            await browser.close()

    print("\n=== results ===")
    for name, ok in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    failed = [n for n, ok in results if not ok]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))