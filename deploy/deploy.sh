
#!/usr/bin/env bash

set -Eeuo pipefail

# --------------------------------------------------
# Configuration
# --------------------------------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILE="$PROJECT_DIR/docker-compose.production.yml"
ENV_FILE="$PROJECT_DIR/.env"

IMAGE_TAG="${1:-}"

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

if [[ -z "$IMAGE_TAG" ]]; then
    fail "Image tag is required. Usage: ./deploy/deploy.sh v0.1.2"
fi

if [[ ! "$IMAGE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    fail "Invalid semantic version: $IMAGE_TAG"
fi

# --------------------------------------------------
# Validate Files
# --------------------------------------------------

[[ -f "$COMPOSE_FILE" ]] || fail "Production Compose file not found."

[[ -f "$ENV_FILE" ]] || fail ".env file not found."

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

COMPOSE=(
    docker compose
    --project-directory "$PROJECT_DIR"
    --env-file "$ENV_FILE"
    -f "$COMPOSE_FILE"
)

log "Validating production configuration..."

"${COMPOSE[@]}" config -q

# --------------------------------------------------
# Pull Images
# --------------------------------------------------

log "Pulling Docker images for version $IMAGE_TAG..."

"${COMPOSE[@]}" pull

# --------------------------------------------------
# Deploy
# --------------------------------------------------

log "Starting production deployment..."

"${COMPOSE[@]}" up -d

# --------------------------------------------------
# Deployment Status
# --------------------------------------------------

log "Current service status:"

"${COMPOSE[@]}" ps

log "Deployment completed for version $IMAGE_TAG."
