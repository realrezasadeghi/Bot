
#!/usr/bin/env bash

set -Eeuo pipefail

# --------------------------------------------------
# Configuration
# --------------------------------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILE="$PROJECT_DIR/docker-compose.production.yml"
ENV_FILE="$PROJECT_DIR/.env"

IMAGE_TAG="${1:-}"
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/realrezasadeghi/bot}"

# --------------------------------------------------
# Helpers
# --------------------------------------------------

log() {
    printf '\n[DEPLOY] %s\n' "$1"
}

fail() {
    printf '\n[DEPLOY ERROR] %s\n' "$1" >&2
    exit 1
}

# --------------------------------------------------
# Validate Input
# --------------------------------------------------

if [[ ! "$IMAGE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    fail "Invalid or missing release tag. Usage: ./deploy/deploy.sh v0.1.2"
fi

# --------------------------------------------------
# Validate Files
# --------------------------------------------------

[[ -f "$COMPOSE_FILE" ]] || fail "Production Compose file not found."
[[ -f "$ENV_FILE" ]] || fail ".env file not found."
[[ -r "$ENV_FILE" ]] || fail ".env file is not readable."

# --------------------------------------------------
# Validate Docker
# --------------------------------------------------

command -v docker >/dev/null 2>&1 || fail "Docker is not installed."

docker info >/dev/null 2>&1 || fail "Docker daemon is not accessible."

docker compose version >/dev/null 2>&1 || fail "Docker Compose is unavailable."

# --------------------------------------------------
# Compose Configuration
# --------------------------------------------------

export IMAGE_TAG
export IMAGE_NAME

COMPOSE=(
    docker compose
    --project-directory "$PROJECT_DIR"
    --env-file "$ENV_FILE"
    -f "$COMPOSE_FILE"
)

on_error() {
    local exit_code="${1:-1}"

    trap - ERR

    printf '\n[DEPLOY ERROR] Deployment failed (exit: %s)\n' "$exit_code" >&2

    log "Current service status:"
    "${COMPOSE[@]}" ps || true

    log "Recent application logs:"
    "${COMPOSE[@]}" logs --tail=80 http worker || true

    exit "$exit_code"
}

trap 'on_error "$?"' ERR

log "Validating production configuration..."

"${COMPOSE[@]}" config -q

# --------------------------------------------------
# Validate Required Services
# --------------------------------------------------

SERVICES="$("${COMPOSE[@]}" config --services)"

for service in postgres migrate http worker; do
    if ! grep -Fxq "$service" <<< "$SERVICES"; then
        fail "Required Compose service not found: $service"
    fi
done

# Ensure application services reference the expected GHCR image.
EXPECTED_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"
CONFIGURED_IMAGES="$("${COMPOSE[@]}" config --images)"

if ! grep -Fxq "$EXPECTED_IMAGE" <<< "$CONFIGURED_IMAGES"; then
    fail "Production Compose does not reference expected image: $EXPECTED_IMAGE"
fi

# --------------------------------------------------
# Pull Application Images
# --------------------------------------------------

log "Pulling application image: $EXPECTED_IMAGE"

"${COMPOSE[@]}" pull migrate http worker

# --------------------------------------------------
# Start PostgreSQL
# --------------------------------------------------

log "Starting PostgreSQL..."

"${COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres

log "PostgreSQL is ready."

# --------------------------------------------------
# Run Database Migrations
# --------------------------------------------------

log "Running database migrations for $IMAGE_TAG..."

"${COMPOSE[@]}" run --rm --no-deps migrate

log "Database migrations completed successfully."

# --------------------------------------------------
# Deploy Application
# --------------------------------------------------

log "Starting HTTP and Worker services..."

"${COMPOSE[@]}" up \
    -d \
    --no-deps \
    --force-recreate \
    --wait \
    --wait-timeout 120 \
    http worker

# --------------------------------------------------
# Deployment Status
# --------------------------------------------------

log "Verifying application health..."

"${COMPOSE[@]}" ps

log "Deployment completed successfully: $IMAGE_TAG"

# --------------------------------------------------
# Cleanup
# --------------------------------------------------

trap - ERR