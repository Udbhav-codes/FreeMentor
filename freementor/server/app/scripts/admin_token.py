"""Mint a short-lived admin token for the local panel.

    python -m app.scripts.admin_token
    python -m app.scripts.admin_token --email someone@else.com --minutes 120

Signs a Supabase-shaped JWT with this project's own secret, so the API
verifies it exactly as it would a real sign-in. It grants nothing on its own:
`current_admin` still checks the address against ADMIN_EMAILS, so a token for
an address that is not listed is refused.

Only for the local panel. There is nothing here a deployed server should run,
and it refuses to mint anything for a production configuration.
"""

from __future__ import annotations

import argparse
import time
import uuid

import jwt

from app.config import get_settings


def main() -> None:
    settings = get_settings()
    allowed = sorted(settings.admin_email_set)

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--email",
        default=allowed[0] if allowed else "",
        help="Which admin to sign in as. Defaults to the first in ADMIN_EMAILS.",
    )
    parser.add_argument("--minutes", type=int, default=60, help="How long it lasts.")
    args = parser.parse_args()

    if settings.is_production:
        raise SystemExit(
            "Refusing to mint a token against a production configuration. "
            "The admin panel is a local tool."
        )

    if not allowed:
        raise SystemExit(
            "ADMIN_EMAILS is empty, so nobody is an admin and this token would be "
            "refused. Add your address to server/.env:\n\n"
            "    ADMIN_EMAILS=you@example.com\n"
        )

    email = args.email.strip().lower()
    if email not in settings.admin_email_set:
        raise SystemExit(
            f"{email} is not in ADMIN_EMAILS ({', '.join(allowed)}), so the API would "
            "refuse this token. Nothing minted."
        )

    if not settings.supabase_jwt_secret:
        # Local mode accepts an unsigned stub instead, which is simpler.
        print(f"local:{uuid.uuid4()}:{email}")
        print(
            "\n(No SUPABASE_JWT_SECRET set, so the server is in local mode and takes "
            "the stub token above.)"
        )
        return

    now = int(time.time())
    token = jwt.encode(
        {
            # A stable id per address, so repeated tokens map to one users row.
            "sub": str(uuid.uuid5(uuid.NAMESPACE_URL, f"freementor-admin/{email}")),
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "iat": now,
            "exp": now + args.minutes * 60,
        },
        settings.supabase_jwt_secret,
        algorithm="HS256",
    )
    print(token)
    print(f"\n({email}, valid {args.minutes} min. Paste it into the panel.)")


if __name__ == "__main__":
    main()
