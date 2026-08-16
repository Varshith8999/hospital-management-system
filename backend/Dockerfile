# Build context is the repository root so that database/ (migrations + seeders)
# ships alongside the API. See docker-compose.yml.
FROM node:20-alpine AS deps

WORKDIR /app/backend
COPY backend/package*.json ./
# Production install only - sqlite3/jest/eslint stay out of the runtime image.
RUN npm ci --omit=dev && npm cache clean --force


FROM node:20-alpine AS runtime

# wget (busybox) powers the container healthcheck; tini reaps zombie processes.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY database ./database

# Drop anything that should never exist in an image.
RUN rm -rf backend/tests backend/.env backend/coverage

WORKDIR /app/backend

RUN addgroup -S hms && adduser -S hms -G hms && chown -R hms:hms /app
USER hms

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
