FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
RUN mkdir -p app \
    && printf '' > app/__init__.py \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --root-user-action=ignore -e ".[dev]"

COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
COPY tests ./tests

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=10 --start-period=10s \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
