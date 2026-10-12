#!/usr/bin/env bash
# =============================================================================
# Deploy dist/ from the current checkout to the production VM over SSH.
# Used by GitHub Actions (runs-on: ubuntu-latest) — no self-hosted runner needed.
#
# Requirements (repo secrets):
#   ONENOVA_SSH_HOST   VM public IP / host (default 92.4.92.63 Mumbai A1)
#   ONENOVA_SSH_USER   SSH user on the VM (default opc)
#   ONENOVA_SSH_KEY    private ed25519 key authorized on the VM
# =============================================================================
set -euo pipefail

HOST="${ONENOVA_SSH_HOST:-92.4.92.63}"
USER="${ONENOVA_SSH_USER:-opc}"
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
  "mkdir -p ~/onenova-api ~/.config/systemd/user && install -m 640 /tmp/resume-api.mjs ~/onenova-api/resume-api.mjs && \
   if [ -x /usr/bin/node ]; then sed -i 's|^ExecStart=.*|ExecStart=/usr/bin/node %h/onenova-api/resume-api.mjs|' /tmp/onenova-resume-api.service; fi && \
   install -m 644 /tmp/onenova-resume-api.service ~/.config/systemd/user/onenova-resume-api.service"

# Stream the secret over SSH without placing it in the repository, command line,
# or job output. The service reads this mode-600 file on the VM only.
printf 'OPENAI_API_KEY=%s\n' "${OPENAI_API_KEY}" | ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" \
  "umask 077 && cat > ~/.config/onenova-resume-api.env"

# Install nginx site config, but keep OTP snippets required by includes.
# Backup live conf first so a bad template can be rolled back.
ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -s <<'REMOTE'
set -euo pipefail
sudo mkdir -p /etc/nginx/snippets
# Ensure OTP snippet files exist so nginx -t succeeds after template install.
for snip in onenova-finance onenova-momentum onenova-covered onenova-orderflow; do
  if [ ! -f "/etc/nginx/snippets/${snip}.conf" ]; then
    echo "# placeholder — installed by covered_call_bot OTP deploy" | sudo tee "/etc/nginx/snippets/${snip}.conf" >/dev/null
  fi
done
BACKUP="/etc/nginx/conf.d/onenova.in.conf.bak-onenova-deploy-$(date +%Y%m%d%H%M%S)"
sudo cp /etc/nginx/conf.d/onenova.in.conf "$BACKUP"
sudo install -m 644 /tmp/onenova.in.conf /etc/nginx/conf.d/onenova.in.conf
if ! sudo nginx -t; then
  echo "nginx -t failed; restoring $BACKUP" >&2
  sudo cp "$BACKUP" /etc/nginx/conf.d/onenova.in.conf
  sudo nginx -t
  exit 1
fi
sudo systemctl reload nginx
sudo loginctl enable-linger "$(id -un)"
# user systemd needs a session bus when linger is freshly enabled
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=${XDG_RUNTIME_DIR}/bus}"
systemctl --user daemon-reload
systemctl --user enable onenova-resume-api.service
systemctl --user restart onenova-resume-api.service
REMOTE

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
