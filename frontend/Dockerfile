# ---------------------------------------------------------------- build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# No API URL is baked in: the app defaults to the same-origin /api path, which
# nginx proxies to the backend. window.__APP_CONFIG__ can override at runtime.
RUN npm run build


# ---------------------------------------------------------------- serve stage
FROM nginx:1.27-alpine AS runtime

ENV BACKEND_URL=http://backend:5000 \
    API_URL=/api

COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine renders /etc/nginx/templates/*.template with envsubst at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1
