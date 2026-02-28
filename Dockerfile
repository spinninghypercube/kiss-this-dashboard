FROM node:20-bookworm AS frontend-build
WORKDIR /src/frontend-svelte
COPY frontend-svelte/package.json frontend-svelte/package-lock.json ./
RUN npm ci
COPY frontend-svelte/ ./
RUN npm run build

FROM golang:1.24-bookworm AS backend-build
WORKDIR /src/backend-go
COPY backend-go/go.mod ./
COPY backend-go/main.go ./
RUN CGO_ENABLED=0 go build -buildvcs=false -o /out/kissdash-go .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY startpage-default-config.json /app/startpage-default-config.json
COPY --from=frontend-build /src/frontend-svelte/dist /app/frontend-svelte/dist
COPY --from=backend-build /out/kissdash-go /app/backend-go/kissdash-go

ENV DASH_BIND=0.0.0.0
ENV DASH_PORT=8788
ENV DASH_DATA_DIR=/data
ENV DASH_PRIVATE_ICONS_DIR=/data/private-icons
ENV DASH_DEFAULT_CONFIG=/app/startpage-default-config.json
ENV DASH_APP_ROOT=/app/frontend-svelte/dist

EXPOSE 8788
VOLUME ["/data"]

CMD ["sh", "-lc", "mkdir -p \"$DASH_DATA_DIR\" \"$DASH_PRIVATE_ICONS_DIR\" && exec /app/backend-go/kissdash-go"]

