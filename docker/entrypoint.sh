#!/bin/sh
set -e

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set" >&2
  exit 1
fi

echo "Running Prisma migrations..."
# Uses prisma/migrations from the image.
# Safe to run on every start.
npx prisma migrate deploy

if [ "${RUN_SEED}" = "true" ]; then
  echo "RUN_SEED=true -> running Prisma seed..."
  npx prisma db seed
fi

echo "Starting app..."
exec "$@"
