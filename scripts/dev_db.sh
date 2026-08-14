#!/usr/bin/env bash
# Start a throwaway single-node CockroachDB for dev/tests (in-memory store).
set -euo pipefail
command -v cockroach >/dev/null 2>&1 || brew install cockroachdb/tap/cockroach
cd "$(mktemp -d /tmp/colony8-crdb.XXXXXX)"
exec cockroach start-single-node --insecure --store=type=mem,size=1GiB \
  --listen-addr=localhost:26257 --http-addr=localhost:8080
