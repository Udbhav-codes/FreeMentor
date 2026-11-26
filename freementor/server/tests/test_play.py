"""GooglePlayVerifier against a fake Google (no network).

Covers the token exchange, each purchaseState, and acknowledgement. The fake
checks the JWT is really signed with the service account's key, so a verifier
that skipped auth would fail here rather than in production.
"""

from __future__ import annotations

import json
from urllib.parse import parse_qs

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app import play

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PEM = KEY.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()
SA = json.dumps(
    {
        "type": "service_account",
        "client_email": "play@freementor.iam.gserviceaccount.com",
        "private_key": PEM,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
)


def fake_google(purchase: dict | None, *, status: int = 200, calls: list | None = None):
    calls = calls if calls is not None else []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, str(request.url)))
        if request.url.host == "oauth2.googleapis.com":
            form = parse_qs(request.content.decode())
            claims = jwt.decode(
                form["assertion"][0],
                KEY.public_key(),
                algorithms=["RS256"],
                audience="https://oauth2.googleapis.com/token",
            )
            assert claims["scope"] == play.ANDROID_PUBLISHER_SCOPE
            return httpx.Response(200, json={"access_token": "ya29.test", "expires_in": 3600})
        assert request.headers["Authorization"] == "Bearer ya29.test"
        if request.url.path.endswith(":acknowledge"):
            return httpx.Response(204)
        if purchase is None:
            return httpx.Response(status, json={})
        return httpx.Response(status, json=purchase)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), calls


@pytest.mark.asyncio
async def test_a_completed_purchase_is_confirmed_with_googles_order_id():
    client, calls = fake_google({"purchaseState": 0, "orderId": "GPA.1234-5678"})
    verifier = play.GooglePlayVerifier(SA, "com.freementor.app", client=client)
    result = await verifier.verify(purchase_token="tok-1", product_id="basic")
    assert result.ok and result.order_id == "GPA.1234-5678"
    assert result.purchase_state == "confirmed"
    assert any(
        "/applications/com.freementor.app/purchases/products/basic/tokens/tok-1" in url
        for _, url in calls
    )


@pytest.mark.asyncio
async def test_a_pending_payment_unlocks_nothing_yet():
    client, _ = fake_google({"purchaseState": 2})
    result = await play.GooglePlayVerifier(SA, "com.freementor.app", client=client).verify(
        purchase_token="tok", product_id="basic"
    )
    assert not result.ok
    assert "pending" in (result.reason or "").lower()


@pytest.mark.asyncio
async def test_a_cancelled_purchase_unlocks_nothing():
    client, _ = fake_google({"purchaseState": 1, "orderId": "GPA.9"})
    result = await play.GooglePlayVerifier(SA, "com.freementor.app", client=client).verify(
        purchase_token="tok", product_id="basic"
    )
    assert not result.ok


@pytest.mark.asyncio
async def test_an_unknown_token_is_refused():
    client, _ = fake_google(None, status=404)
    result = await play.GooglePlayVerifier(SA, "com.freementor.app", client=client).verify(
        purchase_token="made-up", product_id="basic"
    )
    assert not result.ok


@pytest.mark.asyncio
async def test_a_tester_purchase_without_order_id_still_gets_a_stable_id():
    client, _ = fake_google({"purchaseState": 0, "purchaseType": 0})
    verifier = play.GooglePlayVerifier(SA, "com.freementor.app", client=client)
    first = await verifier.verify(purchase_token="tok-x", product_id="premium")
    second = await verifier.verify(purchase_token="tok-x", product_id="premium")
    assert first.ok and first.order_id and first.order_id.startswith("token:")
    # Same token, same id: recording stays idempotent.
    assert first.order_id == second.order_id


@pytest.mark.asyncio
async def test_the_access_token_is_reused_until_it_expires():
    client, calls = fake_google({"purchaseState": 0, "orderId": "GPA.1"})
    verifier = play.GooglePlayVerifier(SA, "com.freementor.app", client=client)
    await verifier.verify(purchase_token="a", product_id="basic")
    await verifier.verify(purchase_token="b", product_id="basic")
    token_calls = [u for _, u in calls if "oauth2.googleapis.com" in u]
    assert len(token_calls) == 1


@pytest.mark.asyncio
async def test_acknowledge_posts_to_google():
    client, calls = fake_google({"purchaseState": 0})
    await play.GooglePlayVerifier(SA, "com.freementor.app", client=client).acknowledge(
        purchase_token="tok-1", product_id="basic"
    )
    assert any(m == "POST" and u.endswith("tokens/tok-1:acknowledge") for m, u in calls)


@pytest.mark.asyncio
async def test_google_being_unreachable_is_a_refusal_not_a_crash():
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    client = httpx.AsyncClient(transport=httpx.MockTransport(boom))
    result = await play.GooglePlayVerifier(SA, "com.freementor.app", client=client).verify(
        purchase_token="tok", product_id="basic"
    )
    assert not result.ok
