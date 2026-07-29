#!/usr/bin/env bash
# =============================================================================
# Deploy Astro static build to /var/www/onenova
# Invoked by GitHub Actions on the self-hosted runner (or manually).
# =============================================================================
set -euo pipefail

WEB_ROOT="${WEB_ROOT:-/var/www/onenova}"
DIST_DIR="${DIST_DIR:-dist}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_DIR="${REPO_ROOT}/${DIST_DIR}"

if [[ ! -d "${BUILD_DIR}" ]]; then
  echo "ERROR: Build directory not found: ${BUILD_DIR}"
  echo "Run 'pnpm build' first."
  exit 1
fi

echo "==> Deploying ${BUILD_DIR} → ${WEB_ROOT}"

# Atomic-ish deploy: stage then rsync
STAGE="$(mktemp -d /tmp/onenova-deploy.XXXXXX)"
cleanup() { rm -rf "${STAGE}"; }
trap cleanup EXIT

# Prefer rsync; fall back to cp
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    "${BUILD_DIR}/" "${STAGE}/"
  mkdir -p "${WEB_ROOT}"
  rsync -a --delete \
    --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
    "${STAGE}/" "${WEB_ROOT}/"
else
  mkdir -p "${WEB_ROOT}"
  # Clear old assets carefully
  find "${WEB_ROOT}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "${BUILD_DIR}/." "${WEB_ROOT}/"
fi

# Ensure readable by nginx
chmod -R a+rX "${WEB_ROOT}" 2>/dev/null || true

# Reload nginx only if config is valid and service is active
if command -v nginx >/dev/null 2>&1; then
  if sudo nginx -t 2>/dev/null; then
    if sudo systemctl is-active --quiet nginx; then
      echo "==> Reloading nginx"
      sudo systemctl reload nginx
    else
      echo "==> nginx not active; starting"
      sudo systemctl start nginx || true
    fi
  else
    echo "WARN: nginx -t failed; not reloading. Site files updated on disk."
  fi
else
  echo "nginx not found on PATH; files deployed to ${WEB_ROOT} only."
fi

echo "==> Deploy complete"
# Show a few key files
ls -la "${WEB_ROOT}" | head -20
