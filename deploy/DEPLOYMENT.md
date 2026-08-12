# OneNova deployment guide

**Site:** https://onenova.in  
**Live server:** `136.67.97.86` (GCP VM `github-runner-free`)  
**Web root:** `/var/www/onenova`  
**Repo:** https://github.com/saurabhahuja71/onenova  
**Site clone on VM:** `~/onenova-site`  

Related:

- [POST_CHANGE_CHECKLIST.md](./POST_CHANGE_CHECKLIST.md) — required steps after every content change  
- [AGENTS.md](../AGENTS.md) — rules for humans and coding agents  
- [scripts/deploy-remote-github.sh](./scripts/deploy-remote-github.sh) — Actions deploy (SSH rsync + nginx reload)  
- [scripts/deploy-remote.sh](./scripts/deploy-remote.sh) — one-command remote deploy from a laptop  

---

## What happens on a normal push (auto-deploy, active)

| What you did | Live on https://onenova.in? |
|--------------|-----------------------------|
| Edit files only on laptop | No |
| Commit + `git push origin main` | **Yes** (Deploy OneNova workflow runs) |
| Manual deploy on VM | Yes (fallback) |

**How it works:** pushing to `main` triggers `.github/workflows/deploy.yml`. It builds on a GitHub-hosted `ubuntu-latest` runner and then runs `deploy/scripts/deploy-remote-github.sh`, which rsyncs `dist/` → `/var/www/onenova` over SSH (deploy key) and reloads nginx. No self-hosted runner is involved.

Repo secrets wired to the workflow:

| Secret | Value |
|--------|-------|
| `ONENOVA_SSH_HOST` | `136.67.97.86` |
| `ONENOVA_SSH_USER` | `sauahuja` |
| `ONENOVA_SSH_KEY` | private ed25519 key; public half authorized on the VM |

Watch the run under the repo’s **Actions** tab after every push.

### Incident log (keep this)

| Date | What went wrong | Fix |
|------|-----------------|-----|
| **2026-08-06** | Oracle RAC blog merged to `main` and pushed. https://onenova.in/blog still listed only Oracle Restart (site last built ~2026-07-30). | Manual deploy: `git reset --hard origin/main` in `~/onenova-site`, `pnpm run build:fast`, `rsync` to `/var/www/onenova`, nginx reload. |

**Rule:** After any blog/page change, run the [post-change checklist](./POST_CHANGE_CHECKLIST.md) and confirm the **public URL** before saying “it’s live.”

---

## Do you need a GitHub runner to rebuild the site?

**No.** The current auto-deploy uses a **GitHub-hosted** runner (`ubuntu-latest`) plus an SSH deploy key — no self-hosted runner, no extra VM resources.

| Approach | Auto on push? | Needs onenova runner? | Status (2026-08) |
|----------|---------------|------------------------|------------------|
| GitHub-hosted `ubuntu-latest` + SSH deploy | Yes | No (uses GitHub minutes) | **Active today** |
| Manual build on the VM (or SSH) | No | No | Fallback |
| Second self-hosted runner for this repo | Yes | Yes (separate from Tradebots) | Not needed |

---

## Current state (important)

The VM at **136.67.97.86** runs a self-hosted runner that belongs to another project:

```text
Tradebots71/covered_call_bot
agent name: fyers-gcp-free
path: ~/actions-runner
service: actions.runner.Tradebots71-covered_call_bot.fyers-gcp-free.service
```

That runner is **repo-scoped to Tradebots only** and is left untouched. **OneNova does not use it** — the deploy workflow is on GitHub-hosted runners.

**Do not reconfigure or re-register the Tradebots runner** for onenova — that can break other Actions on that host.

---

## What is already set up on the VM

- **nginx** serving `/var/www/onenova` (strong static config; `default_server` for IP + domains)
- **Node 20 + pnpm** via user-local **nvm** (`~/.nvm`) — does not replace system tools for other jobs
- **Site clone:** `~/onenova-site`
- **Scoped sudoers** for nginx reload only: `/etc/sudoers.d/onenova-deploy`
- **SSH deploy key** authorized: `github-actions-onenova-deploy` in `~/.ssh/authorized_keys` (used by the Actions workflow)
- **GCP firewall tags:** `http-server`, `https-server` (+ port 22 open for GitHub runner SSH)
- **Tradebots runner:** left running and unchanged

### Check the live site by IP

```text
http://136.67.97.86/
http://136.67.97.86/profile/
http://136.67.97.86/learning-path/
http://136.67.97.86/experience/
http://136.67.97.86/resume/
http://136.67.97.86/contact/
```

Resume files:

```text
http://136.67.97.86/resume/Saurabh-Ahuja-Latest.pdf
http://136.67.97.86/resume/Saurabh-Ahuja-Latest.docx
```

---

## Option A — Manual deploy (fallback; no Actions required)

SSH to the VM (from Oracle network use corkscrew if needed):

```bash
ssh -o "ProxyCommand=corkscrew www-proxy.us.oracle.com 80 %h %p" \
  -i ~/.ssh/id_ed255519 \
  sauahuja@136.67.97.86
```

Then:

```bash
cd ~/onenova-site
git pull origin main
source ~/.nvm/nvm.sh
nvm use 20
export PUBLIC_GITHUB_USERNAME=saurabhahuja71
pnpm install
pnpm run build:fast
rsync -a --delete dist/ /var/www/onenova/
# nginx reload only if config changed
sudo nginx -t && sudo systemctl reload nginx
```

One-liner after code is already on `main` (on the VM):

```bash
cd ~/onenova-site && git fetch origin main && git reset --hard origin/main \
  && source ~/.nvm/nvm.sh && nvm use 20 \
  && PUBLIC_GITHUB_USERNAME=saurabhahuja71 pnpm install \
  && pnpm run build:fast \
  && rsync -a --delete dist/ /var/www/onenova/ \
  && sudo nginx -t && sudo systemctl reload nginx
```

From a laptop that can reach the VM (Oracle network + corkscrew + key):

```bash
# from a clone of saurabhahuja71/onenova
chmod +x deploy/scripts/deploy-remote.sh
./deploy/scripts/deploy-remote.sh
```

Then verify:

```bash
curl -sL https://onenova.in/blog/ | grep -i provision-oracle
curl -sI https://onenova.in/blog/<slug>/
```

---

## Option B — Self-hosted runner (not needed)

Auto-deploy is already handled by **Option C** (GitHub-hosted). A second self-hosted runner on the VM is only relevant if you want to avoid GitHub Actions minutes. If you ever go that route, install a **separate** runner directory so Tradebots is untouched.

1. GitHub → **saurabhahuja71/onenova** → **Settings** → **Actions** → **Runners** → **New self-hosted runner**  
2. Copy the registration token.  
3. On `136.67.97.86`:

```bash
mkdir -p ~/actions-runner-onenova && cd ~/actions-runner-onenova
# Download the runner package from the GitHub UI instructions, then:
./config.sh --url https://github.com/saurabhahuja71/onenova --token <TOKEN>
# Use a distinct name, e.g. onenova-gcp-free
sudo ./svc.sh install
sudo ./svc.sh start
```

4. Confirm **Deploy OneNova** runs on push to `main`.

Workflow already uses:

```yaml
runs-on: self-hosted
```

Optional: add a runner label `onenova` and set:

```yaml
runs-on: [self-hosted, onenova]
```

so only the onenova runner picks up those jobs.

---

## Option C — GitHub-hosted runner (ACTIVE)

This is the current setup. `.github/workflows/deploy.yml` runs on `ubuntu-latest`, builds the site, then deploys via SSH:

```text
push → ubuntu-latest → pnpm build:fast
     → deploy/scripts/deploy-remote-github.sh
         rsync dist/ → sauahuja@136.67.97.86:/var/www/onenova
         sudo nginx -t && sudo systemctl reload nginx
```

Requirements (all already in place):

1. **SSH deploy key** — private key stored as repo secret `ONENOVA_SSH_KEY`; the public key (`github-actions-onenova-deploy`) is in `~/.ssh/authorized_keys` on the VM.
2. **Sudoers scope** — `/etc/sudoers.d/onenova-deploy` allows `sauahuja` to run `nginx -t` and `systemctl reload nginx` without a password.
3. **Network** — the VM’s GCP firewall allows inbound SSH (port 22) from GitHub runner IPs.
4. **rsync** — installed on GitHub-hosted `ubuntu-latest` images by default.

Secrets:

```bash
gh secret set ONENOVA_SSH_KEY < onenova_deploy          # private key
gh secret set ONENOVA_SSH_HOST -b 136.67.97.86
gh secret set ONENOVA_SSH_USER -b sauahuja
```

Rotate / verify: `ssh-keygen -y -f <key>` to confirm the public half matches the one in `authorized_keys` on the VM.

---

## nginx (current stronger variant)

Live idea (simplified):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name onenova.in www.onenova.in 136.67.97.86 _;

    root /var/www/onenova;
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }

    location / {
        try_files $uri $uri.html $uri/index.html $uri/ /404.html;
    }
}
```

Full production template (HTTPS, headers, caching): `deploy/nginx/onenova.in.conf`  
Safe one-time bootstrap notes: `deploy/RUNNER.md`, `deploy/scripts/setup-vm-safe.sh`

---

## DNS and HTTPS (Cloudflare Full Strict — recommended)

**Do not use Cloudflare Flexible SSL** (edge HTTPS only; origin stays HTTP; risk of loops / weaker security).

### Architecture

```text
Visitor ──HTTPS──► Cloudflare ──HTTPS──► GCP VM (nginx + Let's Encrypt) ──► /var/www/onenova
```

### Done on the VM (origin)

- Certbot packages installed  
- Certificate: `/etc/letsencrypt/live/onenova.in/` (onenova.in + www)  
- nginx listens **80** + **443** with valid LE cert  
- HTTP domains redirect to HTTPS; ACME webroot kept for renewal  
- `certbot renew --dry-run` succeeded  
- GCP tags: `http-server`, `https-server` (ports 80/443)

### You must set in Cloudflare dashboard

1. **SSL/TLS → Overview** → **Full (Strict)**  
2. **SSL/TLS → Edge Certificates**:
   - **Always Use HTTPS** = On  
   - **Automatic HTTPS Rewrites** = On  
3. DNS A records for `@` and `www` → `136.67.97.86` (proxied orange cloud is fine once origin has LE cert)

Do **not** change Purelymail MX/TXT for email.

### Verify

```bash
curl -I https://onenova.in
curl -I https://www.onenova.in
# expect 200 and your portfolio title
```

### Renewals

Certbot timer is installed. Manual check:

```bash
sudo certbot renew --dry-run
```

---

## Recommendation

- **Day to day:** push to `main` — auto-deploy handles the rest (Option C).
- **If Actions is down:** Option A (manual deploy) as fallback.
- **Never** repoint the existing Tradebots runner at this repo unless you accept impact on that project.

---

## Related docs

- `deploy/RUNNER.md` — runner safety rules  
- `deploy/DNS.md` — DNS notes  
- `deploy/scripts/deploy-remote-github.sh` — Actions deploy (SSH rsync + nginx reload)  
- `deploy/scripts/deploy.sh` — rsync helper (on-VM)  
- `deploy/scripts/setup-vm-safe.sh` — non-destructive VM bootstrap  
- `README.md` — full project overview  
