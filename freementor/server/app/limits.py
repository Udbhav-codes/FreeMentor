"""Rate limiting for the endpoints where repetition is the attack.

## What this is honestly good for

The counters live **in this process's memory**. Two consequences, stated here
rather than discovered later:

  1. Behind N uvicorn workers or N containers, the effective limit is N times
     what the numbers below say. The deployment is a single small container
     today, so the numbers mean what they say; the moment it scales out this
     needs Redis or the platform's own limiter, and the limits become a
     coarse backstop rather than a guarantee.
  2. Restarting the server forgets every counter.

That is enough to stop a script hammering an endpoint and not enough to stop a
distributed effort. It is deliberately the cheap 90% — the alternative was
nothing at all, which is what was here before.

## Why these endpoints

Most of the API is uninteresting to repeat: syncing your own ticks or reading
your own profile gains an attacker nothing. Four things are different.

**Coupon validation** is the real one. A coupon is worth up to 90% off, the
format is a known shape (`^[A-Z]{6}[0-9]{3}$`), and the endpoint tells you
apart a 404 from a 409 — so it is an oracle you can grind. The format's
keyspace is large, but codes are handed out in batches and a leaked prefix
narrows it fast.

**Consent requests** send a code to somebody else's email or phone. The
per-row 60-second resend cooldown in otp.py stops hammering one parent; it
does not stop cycling through contacts, which is using us to send mail.

**Export** runs a query per enrollment and serialises everything we hold. It
is the most expensive authenticated call in the API.

**Purchase verification** calls out to Google Play, where we have a quota that
somebody else's traffic should not spend.
"""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from app.auth import Principal, current_principal


@dataclass(frozen=True)
class Rule:
    """`count` requests allowed per `seconds`."""

    name: str
    count: int
    seconds: int

    @property
    def retry_after(self) -> int:
        return self.seconds


#: The rules, in one place so they can be read without reading the routes.
COUPON_VALIDATE = Rule("coupon_validate", count=10, seconds=60)
CONSENT_REQUEST = Rule("consent_request", count=5, seconds=3600)
EXPORT = Rule("export", count=5, seconds=3600)
PURCHASE = Rule("purchase", count=20, seconds=3600)
SYNC = Rule("sync", count=60, seconds=60)


class Window:
    """A fixed-window counter per (rule, identity).

    Fixed window rather than a sliding log: it is one integer per key instead
    of a list of timestamps, and the worst case — twice the limit across a
    window boundary — does not matter for limits whose job is to stop a script
    rather than to meter a quota precisely.
    """

    def __init__(self) -> None:
        # key -> (window_started_at, count)
        self._hits: dict[tuple[str, str], tuple[float, int]] = defaultdict(
            lambda: (0.0, 0)
        )

    def check(self, rule: Rule, identity: str, now: float) -> int | None:
        """Records a hit. Returns None when allowed, else seconds to wait.

        Pure enough to test: `now` is passed in, never read from the clock.
        """
        key = (rule.name, identity)
        started, count = self._hits[key]

        if now - started >= rule.seconds:
            self._hits[key] = (now, 1)
            return None

        if count >= rule.count:
            return max(1, int(rule.seconds - (now - started)))

        self._hits[key] = (started, count + 1)
        return None

    def forget(self) -> None:
        """For tests, and for anything that wants a clean slate."""
        self._hits.clear()

    def prune(self, now: float, max_age: int = 7200) -> int:
        """Drops windows that are long expired.

        Without this the dict grows with every distinct caller forever, which
        on a long-running process is a slow memory leak keyed by IP address.
        """
        stale = [k for k, (started, _) in self._hits.items() if now - started > max_age]
        for key in stale:
            del self._hits[key]
        return len(stale)


#: Process-wide. See the module docstring for what that does and does not buy.
window = Window()


def identify(request: Request, principal: Principal | None) -> str:
    """Who to count against.

    The verified Supabase subject when there is one, because it survives a
    changed IP and cannot be spoofed by a header. Falling back to the peer
    address, which is the best available for an unauthenticated call.

    `X-Forwarded-For` is deliberately NOT trusted: any client can send it, so
    reading it here would hand every caller a free way to reset their own
    counter. A deployment behind a proxy should set `--forwarded-allow-ips` on
    uvicorn, which makes `request.client.host` the real peer; that is the one
    place where trusting the header is actually checked.
    """
    if principal is not None:
        return f"sub:{principal.auth_id}"
    client = request.client
    return f"ip:{client.host if client else 'unknown'}"


def limit(rule: Rule):
    """A FastAPI dependency enforcing `rule`.

    Used per-route rather than as global middleware so each limit can suit
    what it protects, and so adding a route does not silently inherit a number
    chosen for something else.
    """

    async def dependency(
        request: Request,
        principal: Principal = Depends(current_principal),
    ) -> None:
        wait = window.check(rule, identify(request, principal), time.monotonic())
        if wait is not None:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(wait)},
            )

    return dependency


def limit_unauthenticated(rule: Rule):
    """The same, for a route that has no token to identify the caller by."""

    async def dependency(request: Request) -> None:
        wait = window.check(rule, identify(request, None), time.monotonic())
        if wait is not None:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(wait)},
            )

    return dependency
