#!/usr/bin/env bash
# =============================================================================
# Deploy dist/ from the current checkout to the production VM over SSH.
# Used by GitHub Actions (runs-on: ubuntu-latest) — no self-hosted runner needed.
#
# Requirements (repo secrets):
#   ONENOVA_SSH_HOST   VM public IP / host (default 136.67.97.86)
#   ONENOVA_SSH_USER   SSH user on the VM (default sauahuja)
#   ONENOVA_SSH_KEY    private ed25519 key authorized on the VM
# =============================================================================
set -euo pipefail

HOST="${ONENOVA_SSH_HOST:-136.67.97.86}"
USER="${ONENOVA_SSH_USER:-sauahuja}"
KEY_FILE="${ONENOVA_SSH_KEY_FILE:-/tmp/onenova_deploy_key}"
WEB_ROOT="${WEB_ROOT:-/var/www/onenova}"
DIST_DIR="${DIST_DIR:-dist}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

if [[ ! -f "${KEY_FILE}" ]]; then
  echo "ERROR: SSH key not found at ${KEY_FILE}. Set ONENOVA_SSH_KEY_FILE." >&2
  exit 1
fi
if [[ ! -d "${DIST_DIR}" ]]; then
  echo "ERROR: build directory '${DIST_DIR}' not found. Run 'pnpm build' first." >&2
  exit 1
fi
command -v rsync >/dev/null 2>&1 || { echo "ERROR: rsync required on the runner." >&2; exit 1; }
if [[ -z "${OPENAI_API_KEY}" ]]; then
  echo "ERROR: OPENAI_API_KEY GitHub secret is required for the resume API." >&2
  exit 1
fi

SSH_OPTS=(-i "${KEY_FILE}" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new)

echo "==> Syncing ${DIST_DIR}/ → ${USER}@${HOST}:${WEB_ROOT}/"
rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  "${DIST_DIR}/" "${USER}@${HOST}:${WEB_ROOT}/"

echo "==> Installing resume API service"
rsync -az -e "ssh ${SSH_OPTS[*]}" \
  server/resume-api.mjs deploy/systemd/onenova-resume-api.service \
  deploy/nginx/onenova.in.conf "${USER}@${HOST}:/tmp/"

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
  "mkdir -p ~/onenova-api ~/.config/systemd/user && install -m 640 /tmp/resume-api.mjs ~/onenova-api/resume-api.mjs && install -m 644 /tmp/onenova-resume-api.service ~/.config/systemd/user/onenova-resume-api.service"

# Stream the secret over SSH without placing it in the repository, command line,
# or job output. The service reads this mode-600 file on the VM only.
printf '%s\n' "${OPENAI_API_KEY}" | ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
  "umask 077 && cat > ~/.config/onenova-resume-api.env"

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
  "systemctl --user daemon-reload && systemctl --user enable --now onenova-resume-api.service && sudo install -m 644 /tmp/onenova.in.conf /etc/nginx/conf.d/onenova.in.conf && sudo nginx -t && sudo systemctl reload nginx"

for attempt in {1..20}; do
  if ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "curl -fsS http://127.0.0.1:8787/api/health" >/dev/null; then
    echo "==> Resume API health check passed"
    break
  fi
  if [[ "${attempt}" == 20 ]]; then
    echo "ERROR: Resume API did not become healthy." >&2
    exit 1
  fi
  sleep 1
done

echo "==> Reloading nginx on ${HOST}"
ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "sudo nginx -t && sudo systemctl reload nginx && echo NGINX_RELOADED"

echo "==> Smoke check (files present)"
ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "ls -la ${WEB_ROOT} | head -15"

echo "==> Deploy complete"
