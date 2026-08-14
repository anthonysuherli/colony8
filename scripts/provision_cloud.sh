#!/usr/bin/env bash
# One-time: provision the free-tier cluster + SQL user via the agent-ready ccloud CLI.
# Docs: https://www.cockroachlabs.com/docs/cockroachcloud/ccloud-get-started
set -euo pipefail
command -v ccloud >/dev/null 2>&1 || brew install cockroachdb/tap/ccloud
ccloud auth login
ccloud cluster create serverless colony8 --cloud AWS --region us-east-1
ccloud cluster user create colony8 colony8_app
ccloud cluster sql colony8 --connection-url   # prints DATABASE_URL — put it in .env
