"""Verifying a Google Play purchase — product plan §10.4.

The app cannot be believed about what was bought. It sends a purchase token;
the server asks Google what that token actually represents and records the
answer. Anything else means a modified client can grant itself Premium.

Swap the implementation, not the flow — the same shape as otp.Sender. Until
there is a Play Console and a service account there is nothing real to ask,
so a local verifier stands in. It accepts ONLY tokens that say in their own
text that they are fake, and config.assert_safe() refuses to start a
production server that is still using it.
"""

from __future__ import annotations

from dataclasses import dataclass

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


class GooglePlayVerifier(Verifier):
    """The real thing, once a service account exists.

    Deliberately unimplemented rather than half-written: a verifier that
    looked finished but returned ok=True unconditionally would be the single
    worst bug this file could carry. It raises, so the gap is impossible to
    miss, and config.assert_safe() already refuses production without the
    credentials it needs.

    What it will do: GET purchases.products on the Android Publisher API with
    the package name, product id and token, require purchaseState == 0
    (purchased) and acknowledgementState handling per §10.4, and return
    Google's orderId.
    """

    name = "google_play"

    def __init__(self, service_account_json: str, package_name: str) -> None:
        self._credentials = service_account_json
        self._package = package_name

    async def verify(self, *, purchase_token: str, product_id: str) -> Verified:
        raise NotImplementedError(
            "GooglePlayVerifier needs the Android Publisher client. "
            "Blocked on a Play Console account and a service account key."
        )

    async def acknowledge(self, *, purchase_token: str, product_id: str) -> None:
        raise NotImplementedError


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
