"""Verifying a Google Play purchase — product plan §10.4.

The app cannot be believed about what was bought. It sends a purchase token;
the server asks Google what that token actually represents and records the
answer. Anything else means a modified client can grant itself Premium.

Swap the implementation, not the flow — the same shape as otp.Sender. With
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON set, GooglePlayVerifier asks Google; without
it a local verifier stands in. It accepts ONLY tokens that say in their own
text that they are fake, and config.assert_safe() refuses to start a
production server that is still using it.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from urllib.parse import quote

import httpx
import jwt

# A local-mode token must start with this. Nothing that could be a real Play
# token is accepted, so a stub can never silently grant a plan in production
# even if one were somehow reachable.
LOCAL_TOKEN_PREFIX = "test:"


@dataclass(frozen=True)
class Verified:
    ok: bool
    """Google's order id. Unique per purchase, and what makes recording idempotent."""
    order_id: str | None = None
    product_id: str | None = None
    """'confirmed' once Google says the purchase is complete and paid."""
    purchase_state: str | None = None
    reason: str | None = None


class Verifier:
    name = "base"

    async def verify(self, *, purchase_token: str, product_id: str) -> Verified:
        raise NotImplementedError

    async def acknowledge(self, *, purchase_token: str, product_id: str) -> None:
        """§10.4: Play auto-refunds anything not acknowledged within 3 days."""
        raise NotImplementedError


class LocalVerifier(Verifier):
    """Stands in for Google until a Play Console exists.

    Accepts `test:<order id>` and nothing else. The token has to name itself
    as a test token, so there is no input that both looks like a real Play
    token and is accepted here.
    """

    name = "local"

    async def verify(self, *, purchase_token: str, product_id: str) -> Verified:
        if not purchase_token.startswith(LOCAL_TOKEN_PREFIX):
            return Verified(
                False,
                reason=(
                    "This server has no Play credentials, so it can only accept a "
                    f"'{LOCAL_TOKEN_PREFIX}<id>' test token."
                ),
            )
        order_id = purchase_token[len(LOCAL_TOKEN_PREFIX) :].strip()
        if not order_id:
            return Verified(False, reason="Test token has no order id.")
        return Verified(
            True,
            order_id=f"{LOCAL_TOKEN_PREFIX}{order_id}",
            product_id=product_id,
            purchase_state="confirmed",
        )

    async def acknowledge(self, *, purchase_token: str, product_id: str) -> None:
        # Nothing to acknowledge; there is no Google on the other end.
        return None


ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
PUBLISHER_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"

# purchases.products: purchaseState
_PURCHASED, _CANCELLED, _PENDING = 0, 1, 2


class GooglePlayVerifier(Verifier):
    """Asks Google, via the Android Publisher API, what a purchase token is.

    Authenticates as the Play service account (a signed JWT exchanged for an
    access token, cached until shortly before it expires) using libraries the
    server already has: PyJWT signs, httpx calls. No Google SDK.

    Grants nothing unless Google answers purchaseState == 0 (purchased).
    Pending payments (UPI that has not cleared, cash at a shop) and cancelled
    ones are refused with a reason the app can show.
    """

    name = "google_play"

    def __init__(
        self,
        service_account_json: str,
        package_name: str,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._package = package_name
        self._client = client
        self._token: str | None = None
        self._token_expires = 0.0
        try:
            info = json.loads(service_account_json)
            self._email = info["client_email"]
            self._key = info["private_key"]
            self._token_uri = info.get("token_uri", "https://oauth2.googleapis.com/token")
        except (ValueError, KeyError, TypeError):
            # Kept, not raised: the server must still boot. Every purchase is
            # then refused with this reason until the key is fixed.
            self._email = self._key = self._token_uri = ""

    async def _access_token(self, client: httpx.AsyncClient) -> str:
        now = time.time()
        if self._token and now < self._token_expires - 60:
            return self._token
        assertion = jwt.encode(
            {
                "iss": self._email,
                "scope": ANDROID_PUBLISHER_SCOPE,
                "aud": self._token_uri,
                "iat": int(now),
                "exp": int(now) + 3600,
            },
            self._key,
            algorithm="RS256",
        )
        response = await client.post(
            self._token_uri,
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
        )
        response.raise_for_status()
        body = response.json()
        self._token = body["access_token"]
        self._token_expires = now + float(body.get("expires_in", 3600))
        return self._token

    def _url(self, product_id: str, purchase_token: str) -> str:
        return (
            f"{PUBLISHER_BASE}/{quote(self._package, safe='')}/purchases/products/"
            f"{quote(product_id, safe='')}/tokens/{quote(purchase_token, safe='')}"
        )

    async def _with_client(self, fn):
        if self._client is not None:
            return await fn(self._client)
        async with httpx.AsyncClient(timeout=15) as client:
            return await fn(client)

    async def verify(self, *, purchase_token: str, product_id: str) -> Verified:
        if not self._email or not self._key:
            return Verified(False, reason="The server's Play credentials are not valid.")

        async def run(client: httpx.AsyncClient) -> Verified:
            try:
                token = await self._access_token(client)
                response = await client.get(
                    self._url(product_id, purchase_token),
                    headers={"Authorization": f"Bearer {token}"},
                )
            except httpx.HTTPError:
                return Verified(False, reason="Could not reach Google Play. Try again shortly.")
            if response.status_code in (400, 404, 410):
                return Verified(False, reason="Google Play does not recognise that purchase.")
            if response.status_code != 200:
                return Verified(False, reason="Google Play could not confirm that purchase.")
            body = response.json()
            state = body.get("purchaseState")
            if state == _PENDING:
                return Verified(
                    False,
                    reason="Your payment is still pending. It unlocks once Google confirms it.",
                )
            if state != _PURCHASED:
                return Verified(False, reason="That purchase was cancelled or refunded.")
            # License-tester purchases can come back without an orderId; the
            # token itself is unique, so a hash of it keeps recording idempotent.
            order_id = body.get("orderId") or (
                "token:" + hashlib.sha256(purchase_token.encode()).hexdigest()[:40]
            )
            return Verified(
                True,
                order_id=order_id,
                product_id=product_id,
                purchase_state="confirmed",
            )

        return await self._with_client(run)

    async def acknowledge(self, *, purchase_token: str, product_id: str) -> None:
        """§10.4. The app acknowledges too; whichever lands first wins.

        Raises on failure so the caller can log it. Google answers 400 for a
        purchase that is already acknowledged, which is success for us.
        """
        if not self._email or not self._key:
            return None

        async def run(client: httpx.AsyncClient) -> None:
            token = await self._access_token(client)
            response = await client.post(
                self._url(product_id, purchase_token) + ":acknowledge",
                headers={"Authorization": f"Bearer {token}"},
                json={},
            )
            if response.status_code in (200, 204, 400):
                return None
            response.raise_for_status()

        await self._with_client(run)


def get_verifier(settings: object) -> Verifier:
    """Picks a verifier from the settings.

    Reads attributes defensively so this can be called with anything that
    carries the two fields, which keeps it testable without a Settings object.
    """
    credentials = getattr(settings, "google_play_service_account_json", "") or ""
    package = getattr(settings, "android_package_name", "") or "com.freementor.app"
    if credentials:
        return GooglePlayVerifier(credentials, package)
    return LocalVerifier()
