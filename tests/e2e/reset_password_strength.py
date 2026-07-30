"""
E2E: /reset-password password strength + rules validation.

Covers:
  1. Weak password -> rules checklist shows failures, submit disabled.
  2. Missing uppercase/number/symbol -> specific rule marked as failed.
  3. Password with spaces -> "sem espaços" rule fails.
  4. Mismatching confirmation -> "As senhas não coincidem" message.
  5. Common password ("senha123!A" style) -> clear "muito comum" error.
  6. Strong password + matching confirm -> no errors, submit enabled, saved.

Supabase auth endpoints are intercepted; no real recovery token is needed.
Run: python3 tests/e2e/reset_password_strength.py
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
SHOTS = Path("/tmp/browser/reset-password-strength")
SHOTS.mkdir(parents=True, exist_ok=True)

USER_ID = "00000000-0000-4000-8000-000000000001"
EMAIL = "recovery@example.com"


def b64(obj) -> str:
    return base64.urlsafe_b64encode(json.dumps(obj).encode()).decode().rstrip("=")


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
    token = ".".join([
        b64({"alg": "HS256", "typ": "JWT"}),
        b64({"sub": USER_ID, "email": EMAIL, "role": "authenticated", "exp": exp,
             "aud": "authenticated", "session_id": "sess-1"}),
        "signature",
    ])
    return {"access_token": token, "token_type": "bearer", "expires_in": 3600,
            "expires_at": exp, "refresh_token": "fake-refresh-token", "user": user_obj()}


async def install_mocks(context, calls):
    async def handler(route: Route):
        req = route.request
        path = urlparse(req.url).path
        if path.endswith("/auth/v1/verify"):
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(session_obj()))
            return
        if path.endswith("/auth/v1/user") and req.method == "PUT":
            calls.append("update_user")
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(user_obj()))
            return
        if path.endswith("/auth/v1/user"):
            await route.fulfill(status=200, content_type="application/json",
                                body=json.dumps(user_obj()))
            return
        if path.endswith("/auth/v1/logout"):
            await route.fulfill(status=204, body="")
            return
        await route.continue_()

    await context.route(f"https://{SUPABASE_HOST}/**", handler)


async def rule_ok(page, rule_id: str) -> bool:
    return await page.get_by_test_id(f"rule-{rule_id}").get_attribute("data-ok") == "true"


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
        confirm = page.get_by_label("Confirmar senha")
        submit = page.get_by_role("button", name="Salvar nova senha")
        await pwd.wait_for(state="visible", timeout=20000)

        # 1) too short / weak
        await pwd.fill("abc")
        await page.wait_for_timeout(200)
        checks.append(("senha curta reprova regra de tamanho", not await rule_ok(page, "length")))
        checks.append(("medidor mostra 'Muito fraca'",
                       await page.get_by_text("Muito fraca", exact=False).is_visible()))
        checks.append(("botão desabilitado com senha fraca", await submit.is_disabled()))
        await page.screenshot(path=str(SHOTS / "1_weak.png"))

        # 2) missing uppercase / number / symbol
        await pwd.fill("abcdefghij")
        await page.wait_for_timeout(200)
        checks.append(("falta maiúscula sinalizada", not await rule_ok(page, "upper")))
        checks.append(("falta número sinalizada", not await rule_ok(page, "number")))
        checks.append(("falta símbolo sinalizada", not await rule_ok(page, "symbol")))
        checks.append(("tamanho aprovado com 10 caracteres", await rule_ok(page, "length")))
        await page.screenshot(path=str(SHOTS / "2_missing_classes.png"))

        # 3) whitespace
        await pwd.fill("Abc def1!")
        await page.wait_for_timeout(200)
        checks.append(("espaço em branco reprovado", not await rule_ok(page, "nospace")))
        await page.screenshot(path=str(SHOTS / "3_space.png"))

        # 4) common password blocked with clear message
        await pwd.fill("Senha123!")
        await page.wait_for_timeout(200)
        common_msg = page.get_by_text("muito comum", exact=False)
        checks.append(("senha comum bloqueada com mensagem clara",
                       await common_msg.is_visible()))
        checks.append(("botão desabilitado para senha comum", await submit.is_disabled()))
        await page.screenshot(path=str(SHOTS / "4_common.png"))

        # 5) mismatching confirmation
        await pwd.fill("Chuvisco#2026")
        await confirm.fill("Chuvisco#2025")
        await page.wait_for_timeout(200)
        mismatch = page.get_by_text("As senhas não coincidem", exact=False)
        checks.append(("confirmação divergente mostra erro", await mismatch.is_visible()))
        checks.append(("botão desabilitado com confirmação divergente", await submit.is_disabled()))
        await page.screenshot(path=str(SHOTS / "5_mismatch.png"))

        # 6) strong + matching -> submits
        await confirm.fill("Chuvisco#2026")
        await page.wait_for_timeout(200)
        all_rules = all([await rule_ok(page, r) for r in
                         ["length", "lower", "upper", "number", "symbol", "nospace"]])
        checks.append(("todas as regras atendidas", all_rules))
        checks.append(("botão habilitado com senha forte", await submit.is_enabled()))
        await page.screenshot(path=str(SHOTS / "6_strong.png"))

        await submit.click()
        try:
            await page.get_by_text("Senha atualizada", exact=False).wait_for(
                state="visible", timeout=10000)
            saved = True
        except Exception:
            saved = "update_user" in calls
        checks.append(("senha forte é aceita e salva", saved))
        await page.screenshot(path=str(SHOTS / "7_saved.png"))

        await browser.close()

    print("\n=== results ===")
    for name, ok in checks:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    return 1 if any(not ok for _, ok in checks) else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))