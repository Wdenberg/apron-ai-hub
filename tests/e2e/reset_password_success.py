"""
E2E: /reset-password happy path.

Covers the full valid-token flow: token_hash validated by Supabase, form
rendered, new password submitted, success toast shown and redirect to /entrar.

Supabase auth endpoints are intercepted so no real recovery token is needed.
Run: python3 tests/e2e/reset_password_success.py
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
SHOTS = Path("/tmp/browser/reset-password-success")
SHOTS.mkdir(parents=True, exist_ok=True)

USER_ID = "00000000-0000-4000-8000-000000000001"
EMAIL = "recovery@example.com"


def b64(obj) -> str:
    raw = json.dumps(obj).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def fake_jwt(exp: int) -> str:
    return ".".join([
        b64({"alg": "HS256", "typ": "JWT"}),
        b64({"sub": USER_ID, "email": EMAIL, "role": "authenticated", "exp": exp,
             "aud": "authenticated", "session_id": "sess-1"}),
        "signature",
    ])


def user_obj():
    return {
        "id": USER_ID,
        "aud": "authenticated",
        "role": "authenticated",
        "email": EMAIL,
        "email_confirmed_at": "2024-01-01T00:00:00Z",
        "phone": "",
        "app_metadata": {"provider": "email", "providers": ["email"]},
        "user_metadata": {},
        "identities": [],
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }


def session_obj():
    exp = int(time.time()) + 3600
    return {
        "access_token": fake_jwt(exp),
        "token_type": "bearer",
        "expires_in": 3600,
        "expires_at": exp,
        "refresh_token": "fake-refresh-token",
        "user": user_obj(),
    }


async def install_mocks(context, calls):
    async def handler(route: Route):
        req = route.request
        path = urlparse(req.url).path
        method = req.method

        if path.endswith("/auth/v1/verify"):
            calls.append("verify")
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(session_obj()))
            return
        if path.endswith("/auth/v1/user") and method == "PUT":
            calls.append("update_user")
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

        # 1) valid token -> form is rendered
        pwd = page.get_by_label("Nova senha")
        await pwd.wait_for(state="visible", timeout=15000)
        await page.screenshot(path=str(SHOTS / "1_form.png"))
        checks.append(("form rendered for valid token", True))
        checks.append(("verify endpoint called", "verify" in calls))

        # 2) submit the new password
        await pwd.fill("novaSenha123")
        await page.get_by_label("Confirmar senha").fill("novaSenha123")
        await page.get_by_role("button", name="Salvar nova senha").click()

        # 3) success toast
        toast = page.get_by_text("Senha atualizada", exact=False)
        try:
            await toast.wait_for(state="visible", timeout=10000)
            toast_ok = True
        except Exception:
            toast_ok = False
        await page.screenshot(path=str(SHOTS / "2_success_toast.png"))
        checks.append(("success toast shown", toast_ok))
        checks.append(("password update request sent", "update_user" in calls))

        # 4) redirect to /entrar after sign out
        try:
            await page.wait_for_url("**/entrar", timeout=10000)
            redirected = True
        except Exception:
            redirected = urlparse(page.url).path == "/entrar"
        await page.screenshot(path=str(SHOTS / "3_entrar.png"))
        checks.append(("redirected to /entrar", redirected))
        print("final url:", page.url, "| supabase calls:", calls)

        await browser.close()

    print("\n=== results ===")
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return 1 if any(not ok for _, ok in checks) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
