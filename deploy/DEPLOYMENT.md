# OneNova deployment guide

**Site:** https://onenova.in (DNS may still be pending)  
**Live server:** `136.67.97.86` (GCP VM `github-runner-free`)  
**Web root:** `/var/www/onenova`  
**Repo:** https://github.com/saurabhahuja71/onenova  

---

## Do you need a GitHub runner to rebuild the site?

**No — not required.**

A GitHub Actions runner is only needed if you want **automatic** build + deploy on every push to `main`.

| Approach | Auto on push? | Needs onenova runner? |
|----------|---------------|------------------------|
| Manual build on the VM (or SSH) | No | No |
| Second self-hosted runner for this repo | Yes | Yes (separate from Tradebots) |
| GitHub-hosted `ubuntu-latest` + SSH deploy | Yes | No (uses GitHub minutes) |

---

## Current state (important)

The VM at **136.67.97.86** already runs a self-hosted runner for:

```text
Tradebots71/covered_call_bot
agent name: fyers-gcp-free
path: ~/actions-runner
service: actions.runner.Tradebots71-covered_call_bot.fyers-gcp-free.service
```

That runner is **repo-scoped to Tradebots only**. It does **not** pick up jobs from `saurabhahuja71/onenova`.

So the workflow **Deploy OneNova** (`.github/workflows/deploy.yml`) will **not** run on this machine until you either:

1. Install a **second** runner registered to `saurabhahuja71/onenova`, or  
2. Switch the workflow to GitHub-hosted runners + remote deploy, or  
3. Keep deploying manually (what we use today).

**Do not reconfigure or re-register the Tradebots runner** for onenova — that can break other Actions on that host.

---

## What is already set up on the VM

- **nginx** serving `/var/www/onenova` (strong static config; `default_server` for IP + domains)
- **Node 20 + pnpm** via user-local **nvm** (`~/.nvm`) — does not replace system tools for other jobs
- **Site clone:** `~/onenova-site`
- **Scoped sudoers** for nginx reload only: `/etc/sudoers.d/onenova-deploy`
- **GCP firewall tags:** `http-server`, `https-server`
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

## Option A — Manual deploy (no runner for onenova)

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

One-liner after code is already on `main`:

```bash
cd ~/onenova-site && git pull && source ~/.nvm/nvm.sh && nvm use 20 \
  && PUBLIC_GITHUB_USERNAME=saurabhahuja71 pnpm install \
  && pnpm run build:fast \
  && rsync -a --delete dist/ /var/www/onenova/
```

---

## Option B — Second self-hosted runner (auto-deploy, safe for Tradebots)

Install a **separate** runner directory so Tradebots is untouched.

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

## Option C — GitHub-hosted runner (no self-hosted for onenova)

Change `.github/workflows/deploy.yml` to `runs-on: ubuntu-latest` and add an SSH deploy step to `136.67.97.86` (deploy key or password in secrets). Build happens on GitHub; only static files land on the VM.

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

- **Day to day:** Option A (manual `git pull` + build on VM) is enough.  
- **Auto every push:** Option B (second runner for onenova only).  
- **Never** repoint the existing Tradebots runner at this repo unless you accept impact on that project.

---

## Related docs

- `deploy/RUNNER.md` — runner safety rules  
- `deploy/DNS.md` — DNS notes  
- `deploy/scripts/deploy.sh` — rsync helper used by Actions  
- `deploy/scripts/setup-vm-safe.sh` — non-destructive VM bootstrap  
- `README.md` — full project overview  
