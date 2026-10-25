#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Banco descartável sem porta exposta e sem dados reais. Docker é opcional para desenvolvimento.
container="prontuario-db-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
image='postgres:17-alpine@sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb'
docker run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then docker logs "$container"; exit 1; fi
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/db-auth-fixture.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/20261025_workspace_v2.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/workspace-db.sql
