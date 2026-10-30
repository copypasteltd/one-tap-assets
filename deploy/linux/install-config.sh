#!/bin/bash
# Reapply the captured configuration on the documented, already provisioned host.
# Does not create or overwrite credentials, databases, certificates or journal state.
set -euo pipefail
test "$(id -u)" = 0
source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
base=/opt/one-tap-assets
test -s /root/cfg/one-tap-assets/app.env
test -f /var/lib/one-tap-assets/postgres/PG_VERSION
test "$(cat /var/lib/one-tap-assets/postgres/PG_VERSION)" = 17
test -x "$base/tools/node/bin/node"
test -x "$base/tools/pgsql/usr/lib/postgresql/17/bin/postgres"
test -f "$base/app/runtime/build/api/main.js"
test -f "$base/app/runtime/build/preview/index.html"
id ypcc >/dev/null
id ypccdb >/dev/null
umask 077
snapshot=/root/cfg/one-tap-assets/config-snapshots/$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 0700 "$snapshot"
if [ -f /etc/nginx/conf.d/one-tap-assets.conf ]; then cp -a /etc/nginx/conf.d/one-tap-assets.conf "$snapshot/"; fi
for file in "$source_dir"/systemd/*; do
  name=$(basename "$file")
  if [ -f "/etc/systemd/system/$name" ]; then cp -a "/etc/systemd/system/$name" "$snapshot/"; fi
  install -m 0644 "$file" "/etc/systemd/system/$name"
done
install -m 0644 "$source_dir/nginx/one-tap-assets.conf" /etc/nginx/conf.d/one-tap-assets.conf
install -d -m 0755 "$base/bin" "$base/public" "$base/public/preview"
install -m 0750 "$source_dir/bin/backup" "$base/bin/backup"
install -m 0644 "$source_dir/public/index.html" "$base/public/index.html"
cp -a "$base/app/runtime/build/preview/." "$base/public/preview/"
chown -R root:root "$base/public/preview"
find "$base/public/preview" -type d -exec chmod 0755 {} +
find "$base/public/preview" -type f -exec chmod 0644 {} +
nginx -t
systemd-analyze verify "$source_dir"/systemd/*.service "$source_dir"/systemd/*.timer
systemctl daemon-reload
systemctl enable --now one-tap-assets-db one-tap-assets-api one-tap-assets-worker one-tap-assets-reaper one-tap-assets-media-maintenance one-tap-assets-backup.timer
systemctl reload nginx
printf 'configuration_applied=true previous_snapshot=%s\n' "$snapshot"
