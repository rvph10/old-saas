#!/bin/sh

set -e

echo "🔍 Checking for required services..."

MAX_TRIES=30
COUNT=0
until pg_isready -h postgres -p 5432 -U postgres || [ $COUNT -eq $MAX_TRIES ]; do
  echo "⏳ PostgreSQL is unavailable - sleeping (attempt: $COUNT/$MAX_TRIES)"
  COUNT=$((COUNT+1))
  sleep 2
done

if [ $COUNT -eq $MAX_TRIES ]; then
  echo "❌ PostgreSQL connection timeout after $MAX_TRIES attempts"
  exit 1
fi
echo "✅ PostgreSQL is ready!"

COUNT=0
until nc -z redis 6379 || [ $COUNT -eq $MAX_TRIES ]; do
  echo "⏳ Redis is unavailable - sleeping (attempt: $COUNT/$MAX_TRIES)"
  COUNT=$((COUNT+1))
  sleep 2
done

if [ $COUNT -eq $MAX_TRIES ]; then
  echo "❌ Redis connection timeout after $MAX_TRIES attempts"
  exit 1
fi
echo "✅ Redis is ready!"

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🔄 Generating Prisma client..."
npx prisma generate

echo "🚀 Starting application..."
exec "$@"