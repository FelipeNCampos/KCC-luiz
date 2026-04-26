#!/usr/bin/env sh
set -eu

docker compose -f docker-compose.prod.yml exec backend python -m app.scripts.seed_admin
