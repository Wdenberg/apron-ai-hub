"""
E2E: /reset-password loading state + double-submit prevention.

Validates that while the new password is being saved:
  - the submit button shows "Salvando..." and is disabled;
  - rapid repeated clicks (and Enter presses) do NOT fire a second
    password-update request to Supabase.

Supabase auth endpoints are intercepted; the password-update response is
delayed so the loading window is observable. No real recovery token needed.
Run: python3 tests/e2e/reset_password_loading.py
"""

import asyncio
import base64
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, Route

BASE = "http://localhost:8080"
SUPABASE_HOST = "c--d357f68d-b1c6-4ec9-96d2-1c06308d6098-prod.lovable.cloud"
SHOTS = Path("/tmp/browser/reset-password-loading")
SHOTS.mkdir(parents=True, exist_ok=True)

USER_ID = "00000000-0000-4000-8000-000000000001"
EMAIL = "recovery@example.com"
UPDATE_DELAY_S = 2.5


def b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")


def fake_jwt(exp: int) -> str:
    return ".".join([
        b64({"alg": "HS256", "typ": "JWT"}),
        b64({"sub": USER_ID, "email": EMAIL, "role": "authenticated", "exp": exp,
             "aud": "authenticated", "session_id": "sess-1"}),
        "signature",
    ])


def user_obj():
    return {
        "id": USER_ID, "aud": "authenticated", "role": "authenticated", "email": EMAIL,
        "email_confirmed_at": "2024-01-01T00:00:00Z", "phone": "",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {}, "identities": [],
        "created_at": "2024-01-01T00:00:00Z", "updated_at": "2024-01-01T00:00:00Z",
    }


def session_obj():
    exp = int(time.time()) + 3600
    return {
        "access_token": fake_jwt(exp), "token_type": "bearer", "expires_in": 3600,
        "expires_at": exp, "refresh_token": "fake-refresh-token", "user": user_obj(),
    }


async def install_mocks(context, calls):
    async def handler(route: Route):
        path = urlparse(route.request.url).path
        method = route.request.method

        if path.endswith("/auth/v1/verify"):
            calls.append("verify")
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(session_obj()))
            return
        if path.endswith("/auth/v1/user") and method == "PUT":
            calls.append("update_user")
            await asyncio.sleep(UPDATE_DELAY_S)  # keep the UI in loading state
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(user_obj()))
            return
        if path.endswith("/auth/v1/user") and method == "GET":
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(user_obj()))
            return
        if path.endswith("/auth/v1/logout"):
            calls.append("logout")
            await route.fulfill(status=204, body="")
            return
        await route.continue_()

    await context.route(f"https://{SUPABASE_HOST}/**", handler)


async def main() -> int:
    checks = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        calls: list[str] = []
        await install_mocks(context, calls)
        page = await context.new_page()

        await page.goto(f"{BASE}/reset-password?token_hash=valid-token&type=recovery",
                        wait_until="domcontentloaded")

        pwd = page.get_by_label("Nova senha")
        await pwd.wait_for(state="visible", timeout=15000)
        await pwd.fill("Chuvisco#2026")
        await page.get_by_label("Confirmar senha").fill("Chuvisco#2026")

        submit = page.get_by_role("button", name="Salvar nova senha")
        checks.append(("submit enabled before sending", await submit.is_enabled()))

        await submit.click()

        # loading state
        saving = page.get_by_role("button", name="Salvando...")
        try:
            await saving.wait_for(state="visible", timeout=5000)
            loading_shown = True
        except Exception:
            loading_shown = False
        checks.append(('button shows "Salvando..."', loading_shown))
        checks.append(("button disabled while saving", await saving.is_disabled()
                       if loading_shown else False))
        await page.screenshot(path=str(SHOTS / "1_loading.png"))

        # rapid double submit attempts: clicks + Enter key on the form
        for _ in range(3):
            await saving.click(force=True, timeout=2000)
            await page.wait_for_timeout(80)
        await pwd.press("Enter")
        await page.wait_for_timeout(300)

        checks.append(("no duplicate request during loading",
                       calls.count("update_user") == 1))

        # let the request finish
        await page.wait_for_url("**/entrar", timeout=15000)
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(SHOTS / "2_after_success.png"))
        checks.append(("exactly one password update in total",
                       calls.count("update_user") == 1))
        print("final url:", page.url, "| supabase calls:", calls)

        await browser.close()

    print("\n=== results ===")
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return 1 if any(not ok for _, ok in checks) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
