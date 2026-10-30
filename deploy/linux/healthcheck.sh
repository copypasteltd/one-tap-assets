#!/bin/bash
# Focused checks for the deployed native LAN instance. No containers or full suite.
set -euo pipefail
test "$(id -u)" = 0
cd /opt/one-tap-assets/app
set -a
. /root/cfg/one-tap-assets/app.env
set +a
export PATH=/opt/one-tap-assets/tools/node/bin:/usr/bin:/bin
node --input-type=module - <<'JS'
import pg from 'pg';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
try {
 const result=(await pool.query(`SELECT current_setting('server_version') AS version,
  (SELECT count(*) FROM schema_migrations) AS migrations,
  (SELECT count(*) FROM presets WHERE source='OFFICIAL') AS official_presets,
  (SELECT count(*) FROM execution_variants WHERE sale_enabled) AS sale_enabled_variants,
  (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls,
  pg_input_is_valid('2026-10-31T00:00:00Z','timestamp with time zone') AS statistics_function`)).rows[0];
 if(Number(result.migrations)!==40||Number(result.official_presets)!==10||!result.tls||!result.statistics_function)throw new Error('Deployment database check failed');
 console.log(JSON.stringify(result));
} finally {await pool.end();}
JS
for unit in one-tap-assets-db one-tap-assets-api one-tap-assets-worker one-tap-assets-reaper one-tap-assets-media-maintenance one-tap-assets-backup.timer; do
  systemctl is-active --quiet "$unit"
  systemctl is-enabled --quiet "$unit"
  printf 'active_and_enabled=%s\n' "$unit"
done
for path in / /healthz /readyz /plus/ /preview/ /ops/support /ops/review /ops/metrics; do
  status=$(curl --cacert /opt/one-tap-assets/public/lan-ca.crt --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' "$PUBLIC_BASE_URL$path")
  test "$status" = 200
  printf 'http=%s path=%s\n' "$status" "$path"
done
printf '%s\n' 'focused_native_lan_healthcheck=PASS'
