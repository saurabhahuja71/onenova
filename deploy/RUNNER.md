# Deploy on GCP self-hosted runner (safe)

**Runner IP:** `136.67.97.86`  
**Site root:** `/var/www/onenova` only  
**Repo:** https://github.com/saurabhahuja71/onenova  

This machine already runs a GitHub Actions self-hosted runner used by **other** workflows.  
OneNova setup must **not** reinstall or reconfigure that runner.

> **2026-08 status:** No runner is registered to `saurabhahuja71/onenova`, so
> push-to-`main` does **not** publish the site. Use **manual deploy**
> ([DEPLOYMENT.md](./DEPLOYMENT.md), [POST_CHANGE_CHECKLIST.md](./POST_CHANGE_CHECKLIST.md))
> until Option B below (second runner) or hosted deploy is enabled.
> See also root [AGENTS.md](../AGENTS.md).

---

## What is safe vs unsafe

| Action | Safe? |
|--------|--------|
| Write `/var/www/onenova` | ✅ Yes |
| Add nginx vhost `onenova.in` (not `default_server`) | ✅ Yes |
| `sudo nginx -t` + `reload` | ✅ Yes (sudoers scoped) |
| Use existing nvm/node/pnpm on the runner user | ✅ Yes |
| Reinstall / re-register `actions-runner` | ❌ No |
| Change runner labels/service without intent | ❌ No |
| Remove default nginx site automatically | ❌ No |
| Force global Node upgrade that breaks other jobs | ❌ No |
| Touch Purelymail email DNS | ❌ No |

---

## One-time setup on `136.67.97.86`

SSH as the **same user** that runs the Actions runner (often `sauahuja` or similar):

```bash
ssh YOUR_USER@136.67.97.86
```

### 1) Confirm runner is healthy (do not change it)

```bash
# Example — paths vary
ps aux | grep -i Runner.Listener | grep -v grep
# or
sudo systemctl status actions.runner.*   # if installed as service
```

If other repos already deploy via Actions on this host, leave that alone.

### 2) Ensure Node 20 + pnpm exist for that user (once)

```bash
node -v    # want v20+
pnpm -v    # if missing:
# corepack enable && corepack prepare pnpm@9.15.0 --activate
```

### 3) Safe website bootstrap (nginx + web root only)

```bash
# After Actions has checked out the repo at least once, or clone once:
git clone https://github.com/saurabhahuja71/onenova.git ~/onenova-site
cd ~/onenova-site
sudo ./deploy/scripts/setup-vm-safe.sh
```

This creates `/var/www/onenova` and an nginx server block for `onenova.in` / `www` / optional IP smoke checks.  
It does **not** claim `default_server` and does **not** remove other sites.

### 4) GCP firewall

Allow ingress **TCP 80** and **TCP 443** to `136.67.97.86` (http-server / https-server tags).

### 5) DNS (website only)

| Type | Name | Value |
|------|------|--------|
| A | `@` | `136.67.97.86` |
| A | `www` | `136.67.97.86` |

Leave Purelymail MX/TXT unchanged.

Then HTTPS:

```bash
sudo certbot --nginx -d onenova.in -d www.onenova.in \
  -m saurabh@onenova.in --agree-tos --redirect
```

---

## Ongoing deploy (automatic)

Push to `main` on `saurabhahuja71/onenova` → workflow **Deploy OneNova** → `runs-on: self-hosted` → builds → rsync to `/var/www/onenova` → nginx reload if configured.

Manual re-run: GitHub → Actions → Deploy OneNova → Run workflow.

---

## How to check the site

```text
http://136.67.97.86/                 # after nginx + deploy (Host-based vhost may need Host header)
http://136.67.97.86/   with Host: onenova.in
https://onenova.in/                  # after DNS + certbot
```

```bash
curl -sS -H 'Host: onenova.in' http://136.67.97.86/ | head
curl -sS https://onenova.in/ | head
```

---

## If Actions stays “queued”

The runner process on `136.67.97.86` is offline or busy:

```bash
# on the VM — start the existing runner the way you already do, e.g.:
cd ~/actions-runner && ./run.sh
# or: sudo systemctl start actions.runner.<org>.<name>.service
```

Do **not** re-run `config.sh` unless you know you need to re-register.

---

## Rollback website only

```bash
sudo rm -rf /var/www/onenova/*
# remove only onenova nginx site:
# sudo rm -f /etc/nginx/sites-enabled/onenova.in
# sudo rm -f /etc/nginx/conf.d/onenova.in.conf
sudo nginx -t && sudo systemctl reload nginx
```

Runner and other apps remain intact.
