#!/usr/bin/env bash
# =============================================================================
# SAFE one-time setup for onenova.in on an EXISTING GitHub Actions runner VM.
#
# Target example: 136.67.97.86 (GCP self-hosted runner)
#
# This script is intentionally conservative:
#   ✅ Installs nginx/certbot only if missing (apt/dnf)
#   ✅ Creates /var/www/onenova (website only)
#   ✅ Adds nginx vhost for onenova.in (does NOT set default_server)
#   ✅ Optional sudoers for nginx -t / reload only
#   ❌ Does NOT install/reconfigure the Actions runner
#   ❌ Does NOT change runner service, labels, or work folder
#   ❌ Does NOT force a global Node upgrade if Node already works
#   ❌ Does NOT touch Purelymail / email DNS
#   ❌ Does NOT overwrite unrelated nginx sites
#
# Usage (SSH to the runner as the same user that runs Actions):
#   cd ~/onenova   # or after first Actions checkout
#   sudo ./deploy/scripts/setup-vm-safe.sh
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-onenova.in}"
WWW_DOMAIN="${WWW_DOMAIN:-www.onenova.in}"
WEB_ROOT="${WEB_ROOT:-/var/www/onenova}"
CERTBOT_WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"
SITE_USER="${SUDO_USER:-${USER}}"
EMAIL_FOR_LETSENCRYPT="${CERTBOT_EMAIL:-saurabh@onenova.in}"
RUNNER_IP="${RUNNER_IP:-136.67.97.86}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Re-run with sudo: sudo $0"
  exit 1
fi

echo "==> SAFE OneNova setup (will not touch GitHub Actions runner config)"
echo "    Web root:  ${WEB_ROOT}"
echo "    Site user: ${SITE_USER}"
echo "    Domains:   ${DOMAIN} ${WWW_DOMAIN}"
echo "    Runner IP: ${RUNNER_IP} (for IP-based smoke checks)"

# ---------------------------------------------------------------------------
# Package manager
# ---------------------------------------------------------------------------
if command -v apt-get >/dev/null 2>&1; then
  PM=apt
elif command -v dnf >/dev/null 2>&1; then
  PM=dnf
elif command -v yum >/dev/null 2>&1; then
  PM=yum
else
  echo "Unsupported OS"; exit 1
fi

install_pkg() {
  if [[ "$PM" == "apt" ]]; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
  elif [[ "$PM" == "dnf" ]]; then
    dnf install -y "$@"
  else
    yum install -y "$@"
  fi
}

echo "==> Ensuring nginx + certbot (install only if needed)"
if [[ "$PM" == "apt" ]]; then
  apt-get update -y
fi
command -v nginx >/dev/null 2>&1 || install_pkg nginx
command -v certbot >/dev/null 2>&1 || install_pkg certbot python3-certbot-nginx || install_pkg certbot
command -v rsync >/dev/null 2>&1 || install_pkg rsync || true
command -v curl >/dev/null 2>&1 || install_pkg curl

# ---------------------------------------------------------------------------
# Node: DO NOT break existing toolchain
# Prefer whatever the runner user already has (nvm / system node)
# ---------------------------------------------------------------------------
echo "==> Node check (non-destructive)"
if sudo -u "${SITE_USER}" bash -lc 'command -v node && node -v' 2>/dev/null; then
  echo "    Runner user already has node — leaving it alone."
else
  echo "    WARN: no node for ${SITE_USER}."
  echo "    Install via nvm as that user (do not overwrite other projects):"
  echo "      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "      nvm install 20 && nvm alias default 20"
fi

if sudo -u "${SITE_USER}" bash -lc 'command -v pnpm || true' | grep -q .; then
  echo "    pnpm already available for ${SITE_USER}"
else
  echo "    pnpm missing — install as ${SITE_USER} only (user-local):"
  echo "      corepack enable && corepack prepare pnpm@9.15.0 --activate"
  echo "      # or: curl -fsSL https://get.pnpm.io/install.sh | sh -"
fi

# ---------------------------------------------------------------------------
# Web root only for onenova — never touch actions-runner dirs
# ---------------------------------------------------------------------------
echo "==> Creating ${WEB_ROOT}"
mkdir -p "${WEB_ROOT}" "${CERTBOT_WEBROOT}"
if [[ ! -f "${WEB_ROOT}/index.html" ]]; then
  cat > "${WEB_ROOT}/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>OneNova — awaiting deploy</title></head>
<body style="font-family:system-ui;padding:2rem;background:#020617;color:#e2e8f0">
  <h1>onenova.in</h1>
  <p>Runner is ready. Waiting for GitHub Actions deploy…</p>
</body></html>
HTML
fi
chown -R "${SITE_USER}:${SITE_USER}" "${WEB_ROOT}"
chmod -R u+rwX,g+rX,o+rX "${WEB_ROOT}"

# ---------------------------------------------------------------------------
# nginx vhost — only server_name onenova.in / www / optional IP smoke host
# NEVER uses default_server so other apps keep their default site
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONF_SRC="${REPO_ROOT}/deploy/nginx/onenova.in.conf"
HTTP_ONLY_CONF="$(mktemp)"

# Until certs exist, install HTTP-only vhost (no SSL blocks that fail nginx -t)
cat > "${HTTP_ONLY_CONF}" <<EOF
# Managed by onenova setup-vm-safe.sh — HTTP bootstrap
# Does NOT set default_server.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN} ${RUNNER_IP};

    root ${WEB_ROOT};
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root ${CERTBOT_WEBROOT};
        default_type "text/plain";
        allow all;
    }

    location / {
        try_files \$uri \$uri.html \$uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }
}
EOF

install_nginx_conf() {
  local src="$1"
  if [[ -d /etc/nginx/sites-available ]]; then
    cp "${src}" /etc/nginx/sites-available/onenova.in
    ln -sfn /etc/nginx/sites-available/onenova.in /etc/nginx/sites-enabled/onenova.in
    # Do NOT remove default site automatically — other apps may use it
    echo "    Installed sites-available/onenova.in (default site left intact)"
  elif [[ -d /etc/nginx/conf.d ]]; then
    cp "${src}" /etc/nginx/conf.d/onenova.in.conf
    echo "    Installed conf.d/onenova.in.conf"
  else
    echo "ERROR: no nginx conf directory found"; exit 1
  fi
}

if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  echo "==> TLS certs found — installing full SSL conf"
  if [[ -f "${CONF_SRC}" ]]; then
    install_nginx_conf "${CONF_SRC}"
  else
    echo "WARN: ${CONF_SRC} missing; keeping HTTP-only"
    install_nginx_conf "${HTTP_ONLY_CONF}"
  fi
else
  echo "==> No TLS certs yet — installing HTTP-only vhost"
  install_nginx_conf "${HTTP_ONLY_CONF}"
fi
rm -f "${HTTP_ONLY_CONF}"

echo "==> nginx test + enable"
if nginx -t; then
  systemctl enable nginx 2>/dev/null || true
  systemctl reload nginx 2>/dev/null || systemctl restart nginx
else
  echo "ERROR: nginx -t failed — config NOT applied to running nginx"
  exit 1
fi

# ---------------------------------------------------------------------------
# Sudoers: ONLY nginx test/reload for the Actions user (idempotent)
# ---------------------------------------------------------------------------
SUDOERS_FILE="/etc/sudoers.d/onenova-deploy"
if [[ ! -f "${SUDOERS_FILE}" ]]; then
  echo "==> Installing passwordless nginx reload for ${SITE_USER}"
  cat > "${SUDOERS_FILE}" <<EOF
# OneNova static site deploy only — does not grant broader privileges
${SITE_USER} ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx, /bin/systemctl is-active nginx, /bin/systemctl start nginx
EOF
  chmod 440 "${SUDOERS_FILE}"
  visudo -cf "${SUDOERS_FILE}"
else
  echo "==> sudoers ${SUDOERS_FILE} already exists — leaving as-is"
fi

# ---------------------------------------------------------------------------
# Certbot (optional now — needs DNS A → this VM first)
# ---------------------------------------------------------------------------
echo ""
echo "==> Let's Encrypt (skip if DNS not pointed yet)"
if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  echo "    Certs already present."
elif dig +short "${DOMAIN}" A 2>/dev/null | grep -q .; then
  echo "    Attempting certbot for ${DOMAIN} ${WWW_DOMAIN}..."
  certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL_FOR_LETSENCRYPT}" --redirect \
    || echo "    certbot failed (OK if DNS not ready). Re-run later."
  # Reinstall full conf after certbot if available
  if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem && -f "${CONF_SRC}" ]]; then
    install_nginx_conf "${CONF_SRC}"
    nginx -t && systemctl reload nginx
  fi
else
  echo "    DNS for ${DOMAIN} not resolving to this host yet — skip certbot."
  echo "    Point A records to ${RUNNER_IP}, then:"
  echo "      sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN} -m ${EMAIL_FOR_LETSENCRYPT} --agree-tos --redirect"
fi

echo ""
echo "============================================"
echo " SAFE setup complete"
echo " Check by IP:   http://${RUNNER_IP}/"
echo " Check domain:  http://${DOMAIN}/  (after DNS)"
echo " Deploy path:   push to main → self-hosted runner → ${WEB_ROOT}"
echo ""
echo " Runner safety:"
echo "  - actions-runner install dir: NOT modified"
echo "  - other nginx sites: NOT removed"
echo "  - default_server: NOT claimed by onenova"
echo "============================================"
