#!/usr/bin/env bash
# Deploy latest origin/main of onenova to production VM (manual path).
# Run from any machine that can SSH to the VM (Oracle corp: uses corkscrew).
#
# Usage:
#   ./deploy/scripts/deploy-remote.sh
#   ONENOVA_SSH_HOST=136.67.97.86 ONENOVA_SSH_USER=sauahuja ./deploy/scripts/deploy-remote.sh
set -euo pipefail

HOST="${ONENOVA_SSH_HOST:-136.67.97.86}"
USER="${ONENOVA_SSH_USER:-sauahuja}"
KEY="${ONENOVA_SSH_KEY:-$HOME/.ssh/id_ed255519}"
PROXY="${ONENOVA_SSH_PROXY:-corkscrew www-proxy.us.oracle.com 80 %h %p}"

SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=30)
if [[ -n "${PROXY}" ]] && command -v corkscrew >/dev/null 2>&1; then
  SSH_OPTS+=(-o "ProxyCommand=${PROXY}")
fi
if [[ -f "${KEY}" ]]; then
  SSH_OPTS+=(-i "${KEY}")
fi

echo "==> Deploying onenova on ${USER}@${HOST} (git reset to origin/main, build, rsync web root)"

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/onenova-site
git fetch origin main
git reset --hard origin/main
echo "HEAD: $(git log -1 --oneline)"
source ~/.nvm/nvm.sh
nvm use 20
export PUBLIC_GITHUB_USERNAME=saurabhahuja71
pnpm install
pnpm run build:fast
rsync -a --delete dist/ /var/www/onenova/
ls /var/www/onenova/blog/ || true
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t && sudo systemctl reload nginx
fi
echo "DEPLOY_DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
REMOTE

echo "==> Live smoke (blog index)"
curl -sL "https://onenova.in/blog/" | grep -oE 'href="/blog/[^"]+"' | head -20 || true
echo "==> Done. Confirm your post URL in the browser."
