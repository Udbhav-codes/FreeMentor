"""Response headers and cross-origin policy.

## CORS

There was no CORS configuration at all, which — worth being precise about —
was not itself a vulnerability. No `Access-Control-Allow-Origin` means a
browser on another origin cannot read a response, and the mobile app is native
`fetch`, which CORS does not apply to. The default was safe.

What it was, was unfinished: the admin panel is a React web app on these same
APIs, and the moment it is served from its own origin somebody has to add
CORS under time pressure. The shortest thing that makes the error go away is
`allow_origins=["*"]` with `allow_credentials=True`, which browsers reject in
that combination, so the next shortest thing is reflecting the request's
origin — and that is a real vulnerability.

So the allowlist is here now, read from `CORS_ORIGINS`, defaulting to empty.
Empty means no CORS headers, i.e. exactly today's behaviour. There is no
wildcard path through this function.

## Headers

`web/src/_headers` already covers the static site on Cloudflare/Netlify. The
API serves the same policy pages and the account-deletion page itself (see
routers/web.py) for local development, and those responses got no headers at
all. This middleware covers them.

The CSP is deliberately not applied to the JSON API — a Content-Security-Policy
on a JSON response does nothing, and a strict one on the HTML pages has to
allow what the deletion page actually loads: the Supabase JS client from a
CDN, and its connections back to the project. Those are enumerated rather than
blanket-allowed.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings

#: Where the Supabase browser client is loaded from by the deletion page.
SUPABASE_CDN = "https://cdn.jsdelivr.net"

#: Applied to every response, JSON included. Cheap and never wrong.
BASE_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    # No stale copy of a signed-in page in a shared browser's cache.
    "Cache-Control": "no-store",
}


def html_csp(settings: Settings) -> str:
    """A CSP for the HTML pages this API serves.

    `'unsafe-inline'` for styles and scripts is not laziness to be cleaned up
    later — delete-account.html is a single self-contained file with an inline
    <script> and inline <style>, which is what lets it be copied to any static
    host with no build step. Removing it would mean hashing the inline blocks
    at build time, and the page's value is that it needs no build.

    `connect-src` names the project so the page can talk to Supabase Auth and
    the REST endpoint, and nothing else.
    """
    connect = ["'self'"]
    if settings.supabase_url:
        connect.append(settings.supabase_url.rstrip("/"))
    return "; ".join(
        [
            "default-src 'self'",
            f"script-src 'self' 'unsafe-inline' {SUPABASE_CDN}",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            f"connect-src {' '.join(connect)}",
            "form-action 'none'",
            "frame-ancestors 'none'",
            "base-uri 'none'",
            "object-src 'none'",
        ]
    )


def install(app: FastAPI, settings: Settings) -> None:
    """Wires CORS and the header middleware onto the app."""

    origins = [
        part.strip() for part in settings.cors_origins.split(",") if part.strip()
    ]
    if origins:
        # Only ever an explicit list. `allow_origins=["*"]` is not reachable
        # from here, and nothing reflects the request's Origin back.
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type"],
            max_age=600,
        )

    @app.middleware("http")
    async def add_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        for name, value in BASE_HEADERS.items():
            response.headers.setdefault(name, value)

        content_type = response.headers.get("content-type", "")
        if content_type.startswith("text/html"):
            response.headers.setdefault("Content-Security-Policy", html_csp(settings))
            if settings.is_production:
                # Only in production: sending HSTS from a local http server
                # pins localhost to https in the developer's browser, which is
                # a genuinely annoying thing to debug.
                response.headers.setdefault(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains",
                )
        return response
