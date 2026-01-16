#!/usr/bin/env bash
set -euo pipefail

# Install logrotate config for apply-and-health cron log.
# Usage: sudo -i; /opt/ucm/deploy/scripts/setup-apply-health-logrotate.sh

logrotate_path="/etc/logrotate.d/ucm-apply-health"

cat > "$logrotate_path" <<'EOF'
/var/log/ucm-apply-health.log {
  daily
  rotate 14
  missingok
  notifempty
  compress
  delaycompress
  copytruncate
}
EOF

chmod 644 "$logrotate_path"
echo "Logrotate installed: $logrotate_path"
