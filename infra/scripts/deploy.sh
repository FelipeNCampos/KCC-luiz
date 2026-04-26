#!/usr/bin/env sh
set -eu

COMPOSE_FILES="-f docker-compose.prod.yml"

echo "Pulling base images..."
docker compose $COMPOSE_FILES pull db proxy || true

echo "Building application images..."
docker compose $COMPOSE_FILES build

echo "Starting database..."
docker compose $COMPOSE_FILES up -d db

echo "Starting application stack..."
docker compose $COMPOSE_FILES up -d --remove-orphans

echo "Current containers:"
docker compose $COMPOSE_FILES ps
