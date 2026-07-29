#!/usr/bin/env bash
# =============================================================================
# OneNova VM bootstrap — Ubuntu / Debian / Oracle Linux (dnf)
# Run once on the GCP VM that already hosts the GitHub Actions runner.
#
# Usage:
#   chmod +x deploy/scripts/setup-vm.sh
#   ./deploy/scripts/setup-vm.sh
#
# What this does:
#   - Installs nginx, certbot, Node 20, pnpm
#   - Creates /var/www/onenova owned by the runner user
#   - Installs nginx site config
#   - Obtains Let's Encrypt certs for onenova.in + www.onenova.in
#
# What this does NOT do:
#   - Touch email/MX/TXT DNS for Purelymail
#   - Configure the GitHub Actions runner (already present)
# =============================================================================
set -euo pipefail

DOMAIN="onenova.in"
WWW_DOMAIN="www.onenova.in"
WEB_ROOT="/var/www/onenova"
CERTBOT_WEBROOT="/var/www/certbot"
SITE_USER="${SUDO_USER:-${USER}}"
EMAIL_FOR_LETSENCRYPT="${CERTBOT_EMAIL:-saurabh@onenova.in}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please re-run with sudo: sudo $0"
  exit 1
fi

echo "==> Detecting package manager"
if command -v apt-get >/dev/null 2>&1; then
  PM=apt
elif command -v dnf >/dev/null 2>&1; then
  PM=dnf
elif command -v yum >/dev/null 2>&1; then
  PM=yum
else
  echo "Unsupported OS: need apt or dnf/yum"
  exit 1
fi

echo "==> Installing nginx + certbot"
if [[ "$PM" == "apt" ]]; then
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx curl ca-certificates gnupg
elif [[ "$PM" == "dnf" ]]; then
  dnf install -y nginx certbot python3-certbot-nginx curl ca-certificates
else
  yum install -y nginx certbot python3-certbot-nginx curl ca-certificates
fi

echo "==> Ensuring Node.js 20+"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
  if [[ "$PM" == "apt" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    # Prefer nvm if already installed for the runner user
    echo "Install Node 20 via nvm as ${SITE_USER}, or enable NodeSource for dnf."
    echo "Example as ${SITE_USER}:"
    echo '  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash'
    echo '  nvm install 20 && nvm use 20'
  fi
fi

echo "==> Installing pnpm (if missing)"
if ! command -v pnpm >/dev/null 2>&1; then
  # Prefer corepack
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.15.0 --activate || true
  fi
  if ! command -v pnpm >/dev/null 2>&1; then
    npm install -g pnpm@9.15.0 || {
      curl -fsSL https://get.pnpm.io/install.sh | sh -
    }
  fi
fi

echo "==> Creating web directories"
mkdir -p "${WEB_ROOT}" "${CERTBOT_WEBROOT}"
# Placeholder index so nginx has something before first deploy
if [[ ! -f "${WEB_ROOT}/index.html" ]]; then
  cat > "${WEB_ROOT}/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>OneNova — deploying</title></head>
<body style="font-family:system-ui;padding:3rem;background:#020617;color:#e2e8f0">
  <h1>onenova.in</h1>
  <p>Awaiting first GitHub Actions deploy…</p>
</body></html>
HTML
fi
chown -R "${SITE_USER}:${SITE_USER}" "${WEB_ROOT}"
chmod -R u+rwX,g+rX,o+rX "${WEB_ROOT}"

echo "==> Installing nginx site config"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONF_SRC="${REPO_ROOT}/deploy/nginx/onenova.in.conf"

if [[ -d /etc/nginx/sites-available ]]; then
  cp "${CONF_SRC}" /etc/nginx/sites-available/onenova.in
  ln -sfn /etc/nginx/sites-available/onenova.in /etc/nginx/sites-enabled/onenova.in
  rm -f /etc/nginx/sites-enabled/default || true
elif [[ -d /etc/nginx/conf.d ]]; then
  cp "${CONF_SRC}" /etc/nginx/conf.d/onenova.in.conf
else
  echo "Could not find nginx conf directory"
  exit 1
fi

# Temporary: if certs do not exist yet, use a HTTP-only bootstrap conf
if [[ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  echo "==> No certs yet — writing temporary HTTP-only server for ACME"
  cat > /etc/nginx/conf.d/onenova-http-bootstrap.conf 2>/dev/null || \
  cat > /etc/nginx/sites-available/onenova-bootstrap <<'BOOT'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name onenova.in www.onenova.in;
    root /var/www/onenova;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }
    location / {
        try_files $uri $uri/ /index.html;
    }
}
BOOT
  # Comment out SSL server blocks temporarily if nginx -t fails
  echo "Note: If nginx -t fails on missing SSL certs, disable the HTTPS server blocks"
  echo "in the site config until certbot succeeds, or use certbot --nginx."
fi

echo "==> Enabling nginx"
systemctl enable nginx
# Test config carefully
if nginx -t 2>/dev/null; then
  systemctl restart nginx
else
  echo "WARN: nginx -t failed (likely missing SSL files). Starting HTTP-only if possible."
  systemctl restart nginx || true
fi

echo "==> Opening firewall ports (best-effort)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' || { ufw allow 80/tcp; ufw allow 443/tcp; }
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http || firewall-cmd --permanent --add-port=80/tcp
  firewall-cmd --permanent --add-service=https || firewall-cmd --permanent --add-port=443/tcp
  firewall-cmd --reload || true
fi

echo "==> Let's Encrypt certificates"
echo "Ensure DNS A/AAAA records for ${DOMAIN} and ${WWW_DOMAIN} point to this VM."
echo "Do NOT change MX/TXT records used by Purelymail."
if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  echo "Certificates already present."
else
  certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL_FOR_LETSENCRYPT}" \
    --redirect || {
      echo "certbot --nginx failed; trying webroot plugin..."
      certbot certonly --webroot -w "${CERTBOT_WEBROOT}" \
        -d "${DOMAIN}" -d "${WWW_DOMAIN}" \
        --non-interactive --agree-tos -m "${EMAIL_FOR_LETSENCRYPT}"
      # Reinstall full SSL conf now that certs exist
      if [[ -d /etc/nginx/sites-available ]]; then
        cp "${CONF_SRC}" /etc/nginx/sites-available/onenova.in
      else
        cp "${CONF_SRC}" /etc/nginx/conf.d/onenova.in.conf
      fi
      nginx -t && systemctl reload nginx
    }
fi

# Certbot renew timer
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

echo "==> Granting ${SITE_USER} passwordless nginx reload (deploy only)"
SUDOERS_FILE="/etc/sudoers.d/onenova-deploy"
cat > "${SUDOERS_FILE}" <<EOF
# Allow GitHub Actions runner user to reload nginx after static deploy
${SITE_USER} ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx, /bin/systemctl is-active nginx
EOF
chmod 440 "${SUDOERS_FILE}"
visudo -cf "${SUDOERS_FILE}"

echo ""
echo "============================================"
echo " VM setup complete"
echo " Web root:     ${WEB_ROOT}"
echo " Nginx user:   deploy as ${SITE_USER}"
echo " Domains:      https://${DOMAIN}  https://${WWW_DOMAIN}"
echo " Email DNS:    untouched (Purelymail)"
echo " Next: push to GitHub to trigger deploy.yml"
echo "============================================"
