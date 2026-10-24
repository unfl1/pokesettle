FROM node:22-bookworm-slim AS calculator
WORKDIR /calculator
RUN npm install --global pnpm@11.25.0
COPY backend/calculator/package.json backend/calculator/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    UV_LINK_MODE=copy \
    OMP_NUM_THREADS=1 \
    TOKENIZERS_PARALLELISM=false
WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates libgomp1 libstdc++6 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv==0.9.5 \
    && groupadd --gid 10001 poketact \
    && useradd --uid 10001 --gid poketact --no-create-home poketact
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --python /usr/local/bin/python \
    && uv cache clean
COPY --from=calculator /usr/local/bin/node /usr/local/bin/node
COPY --from=calculator /calculator/node_modules ./backend/calculator/node_modules
COPY backend ./backend
COPY data ./data
RUN mkdir -p /app/runtime && chown -R poketact:poketact /app/data /app/runtime
USER poketact
EXPOSE 8000
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-proxy-headers", "--no-access-log"]
