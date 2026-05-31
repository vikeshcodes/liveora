FROM node:24-slim AS deps
WORKDIR /app

COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
COPY admin/package*.json admin/

RUN npm --prefix backend ci \
  && npm --prefix frontend ci \
  && npm --prefix admin ci

FROM deps AS build
WORKDIR /app
COPY backend backend
COPY frontend frontend
COPY admin admin

RUN npm --prefix frontend run build \
  && npm --prefix admin run build \
  && npm --prefix backend run build \
  && mkdir -p backend/public/overlay backend/public/admin \
  && cp -R frontend/dist/. backend/public/overlay/ \
  && cp -R admin/dist/. backend/public/admin/

FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
  LIVEORA_MODE=docker \
  CREATOR_OS_MODE=docker \
  PORT=3080 \
  HOST=0.0.0.0 \
  APP_BASE_URL=http://localhost:3080 \
  PUBLIC_APP_URL=http://localhost:3080 \
  DATABASE_PROVIDER=sqlite \
  DATABASE_URL=file:/app/data/liveora.db \
  LIVEORA_DATA_DIR=/app/data \
  OVERLAY_TOKEN_SECRET=change_this_local_secret \
  REQUIRE_OVERLAY_TOKEN=false

COPY backend/package*.json backend/
RUN npm --prefix backend ci --omit=dev

COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/public backend/public

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3080

CMD ["node", "backend/dist/index.js"]
