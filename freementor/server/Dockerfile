# FreeMentor API.
#
# Two stages so the image carries the runtime and not the build toolchain:
# asyncpg and cryptography compile against C headers that have no business in
# a production image.
#
# Build from the REPOSITORY ROOT, not from server/:
#
#     docker build -f freementor/server/Dockerfile -t freementor-api .
#
# That is deliberate and is the one thing most likely to go wrong. The policy
# pages are served from `docs/legal/`, which lives outside server/ — a build
# context of server/ alone produces an image whose /privacy and /terms are
# 404, which Google Play rejects a listing for. The COPY below is what makes
# that a build-time error instead.

FROM python:3.13-slim AS build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY freementor/server/pyproject.toml ./
# A stub package so `pip install .` can resolve the project metadata without
# the sources, keeping the dependency layer cacheable across code changes.
RUN mkdir -p app && touch app/__init__.py \
 && python -m venv /venv \
 && /venv/bin/pip install --upgrade pip \
 && /venv/bin/pip install .


FROM python:3.13-slim AS runtime

# Runs as nobody. The API writes nothing to disk — uploads go straight to
# Supabase Storage via a signed ticket — so there is no directory it needs to
# own.
RUN useradd --create-home --shell /usr/sbin/nologin app

ENV PATH="/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production

COPY --from=build /venv /venv

WORKDIR /srv
COPY freementor/server/app ./app
COPY freementor/server/migrations ./migrations
# Served by routers/web.py. See the note at the top: without these the policy
# pages 404 and the Play listing is refused.
COPY docs/legal ./docs/legal
ENV LEGAL_DOCS_DIR=/srv/docs/legal

USER app
EXPOSE 8000

# /health reports the environment, whether real tokens are verified, and
# whether OTP echo is on — enough for a container check to catch a box that
# booted into local mode.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=4).status==200 else 1)"

# --forwarded-allow-ips is required, not optional: app/limits.py keys rate
# limits on request.client.host and deliberately does NOT trust
# X-Forwarded-For, so behind a proxy every caller would otherwise share the
# proxy's address and one noisy client would rate-limit everybody. Set it to
# the proxy's address; "*" is only safe when nothing but the proxy can reach
# this container.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --forwarded-allow-ips ${FORWARDED_ALLOW_IPS:-127.0.0.1}"]
