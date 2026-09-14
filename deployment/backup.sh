#!/usr/bin/env bash
set -euo pipefail
cd /home/ems/ovec-mapping
umask 077
mkdir -p backups
stamp=$(date -u +%Y%m%dT%H%M%SZ)
docker pause ovec-mapping-app >/dev/null
trap 'docker unpause ovec-mapping-app >/dev/null' EXIT
tar -czf "backups/data-${stamp}.tar.gz" shared
docker unpause ovec-mapping-app >/dev/null
trap - EXIT
sha256sum "backups/data-${stamp}.tar.gz" > "backups/data-${stamp}.tar.gz.sha256"
printf '%s\n' "Backup saved: backups/data-${stamp}.tar.gz"
