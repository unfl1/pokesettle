#!/usr/bin/env bash
# Ephemeral integration test: synthetic data, isolated project/volumes, random loopback port.
set -euo pipefail
task_docker=(docker)
if ! docker info >/dev/null 2>&1; then task_docker=(sudo docker); fi
task_project="poketact-monitoring-check-$$"
task_directory=$(mktemp -d)
task_image="${VERIFY_BACKEND_IMAGE:-poketact-backend:${GITHUB_SHA:-local}}"
compose() {
  "${task_docker[@]}" compose --project-name "$task_project" --project-directory "$task_directory" \
    --env-file "$task_directory/.env.production" \
    -f "$task_directory/compose.production.yaml" -f "$task_directory/compose.observability.yaml" \
    -f "$task_directory/test.yaml" "$@"
}
cleanup() {
  task_exit=$?
  if [[ "$task_exit" != 0 ]]; then compose logs --tail 25 alloy loki grafana >&2 || true; fi
  compose down --volumes >/dev/null 2>&1 || true
  rm -rf "$task_directory"
}
trap cleanup EXIT
mkdir -p "$task_directory/deployment"
cp -R deployment/observability "$task_directory/deployment/"
cp deployment/docker/compose.production.yaml deployment/docker/compose.observability.yaml "$task_directory/"
umask 077
printf 'POSTGRES_PASSWORD=synthetic-monitoring-test\n' > "$task_directory/.env.production"
printf 'GF_SECURITY_ADMIN_USER=admin\nGF_SECURITY_ADMIN_PASSWORD=synthetic-monitoring-test\n' > "$task_directory/.env.observability"
cat > "$task_directory/test.yaml" <<'YAML'
services:
  grafana:
    ports: !override ["127.0.0.1::3000"]
YAML
"${task_docker[@]}" run --rm --network none --user 0 --entrypoint python \
  -v "${task_project}_runtime_data:/runtime" -v "${task_project}_alloy_data:/alloy" "$task_image" -c '
import json, os, time
from pathlib import Path
os.chown("/alloy", 10001, 10001)
directory = Path("/runtime/telemetry")
directory.mkdir(mode=0o700, exist_ok=True)
os.chown(directory, 10001, 10001)
path = directory / "events.jsonl"
path.write_text(json.dumps({"timestamp":time.time(), "event":"http", "method":"GET", "route":"/synthetic-check", "status":200, "request_id":"synthetic", "duration_seconds":0.1}) + "\n")
os.chown(path, 10001, 10001)
'
compose config --quiet
for attempt in 1 2 3; do
  if compose pull prometheus loki alloy node-exporter grafana >/dev/null 2>&1; then break; fi
  if [[ "$attempt" == 3 ]]; then echo 'Monitoring image pull failed' >&2; exit 1; fi
  sleep 5
done
compose up -d --wait prometheus loki alloy node-exporter grafana >/dev/null
task_address=$(compose port grafana 3000)
if [[ ! "$task_address" =~ ^127\.0\.0\.1:[1-9][0-9]*$ ]]; then
  echo 'Grafana test port was not published on loopback' >&2
  exit 1
fi
python3 - "$task_address" <<'PY'
import base64
import json
import sys
import time
import urllib.request

base = 'http://' + sys.argv[1]
auth = 'Basic ' + base64.b64encode(b'admin:synthetic-monitoring-test').decode()
def get(path):
    request = urllib.request.Request(base + path, headers={'Authorization': auth})
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)
deadline = time.monotonic() + 180
for attempt in range(90):
    try:
        assert get('/api/health')['database'] == 'ok'
        assert get('/api/dashboards/uid/poketact-operations')['dashboard']['title'] == 'PokeTact Operations'
        metrics = get('/api/datasources/proxy/uid/prometheus/api/v1/query?query=up')
        jobs = {row['metric']['job']: row['value'][1] for row in metrics['data']['result']}
        assert jobs.get('node') == '1' and jobs.get('loki') == '1'
        logs = get('/api/datasources/proxy/uid/loki/loki/api/v1/query_range?query=%7Bjob%3D%22poketact%22%7D')
        assert any('synthetic-check' in value[1] for stream in logs['data']['result'] for value in stream['values'])
        print('Grafana authentication/dashboard, host/Loki scrape, Alloy ingestion and Loki query: PASS')
        break
    except Exception:
        if attempt == 89 or time.monotonic() > deadline:
            raise SystemExit('Monitoring integration failed; no production data was used') from None
        time.sleep(2)
PY
