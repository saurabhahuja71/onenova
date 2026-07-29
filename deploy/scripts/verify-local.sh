#!/usr/bin/env bash
# Quick sanity checks after a local build (no network required beyond optional curl).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="${ROOT}/dist"

echo "==> Checking dist/"
test -d "${DIST}" || { echo "Run pnpm build first"; exit 1; }
test -f "${DIST}/index.html"
test -f "${DIST}/about/index.html" -o -f "${DIST}/about.html"
test -f "${DIST}/rss.xml" -o -f "${DIST}/rss.xml.html" || ls "${DIST}" | grep -i rss || true
test -f "${DIST}/robots.txt"
test -f "${DIST}/favicon.svg"

echo "==> Key pages present"
for p in index.html robots.txt favicon.svg site.webmanifest; do
  test -e "${DIST}/${p}" && echo "  OK ${p}" || echo "  MISSING ${p}"
done

echo "==> Size"
du -sh "${DIST}"
find "${DIST}" -type f | wc -l | xargs -I{} echo "  {} files"

echo "verify-local: OK"
