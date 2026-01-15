#!/usr/bin/env bash
set -euo pipefail

# Install daily cron to run apply-and-health (log to /var/log/ucm-apply-health.log).
# Usage: sudo -i; /opt/ucm/deploy/scripts/setup-apply-health-cron.sh

cron_line='10 4 * * * /opt/ucm/deploy/scripts/apply-and-health.sh >> /var/log/ucm-apply-health.log 2>&1'

tmp_cron="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'apply-and-health.sh' > "$tmp_cron" || true
echo "$cron_line" >> "$tmp_cron"
crontab "$tmp_cron"
rm -f "$tmp_cron"

echo "Cron instalado:"
crontab -l | grep 'apply-and-health.sh'
