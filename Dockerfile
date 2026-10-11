FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY pyproject.toml README.md ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts/api-entrypoint.sh /app/scripts/api-entrypoint.sh

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --root-user-action=ignore . \
    && chmod +x /app/scripts/api-entrypoint.sh \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=20s \
    CMD-SHELL curl -fsS "http://127.0.0.1:${PORT:-8000}/health" || exit 1

ENTRYPOINT ["/app/scripts/api-entrypoint.sh"]


FROM runtime AS development

USER root
COPY tests ./tests
RUN pip install --no-cache-dir --root-user-action=ignore -e ".[dev]" \
    && chown -R appuser:appuser /app
USER appuser

# Render Docker builds the last stage. Local compose still selects --target.
FROM runtime
