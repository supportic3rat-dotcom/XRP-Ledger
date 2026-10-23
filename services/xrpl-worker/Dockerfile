# XRPL worker (Fly.io / Railway). Build from the repo root: docker build -f services/xrpl-worker/Dockerfile .
FROM node:20-slim
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @xrp/xrpl-worker...
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@xrp/xrpl-worker", "start"]
