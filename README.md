# onenova.in

Personal engineering portfolio for **Saurabh Ahuja** — Principal Member of Technical Staff at Oracle (RACPACK MAA Solution Engineering).

Static site built with **Astro + Tailwind CSS + TypeScript**, served by **nginx** on a free-tier **GCP VM**. Source is on GitHub; **production is updated by manual deploy today** (Actions auto-deploy is not wired to a runner for this repo yet).

| | |
|---|---|
| **Site** | https://onenova.in · https://www.onenova.in |
| **Email** | saurabh@onenova.in (Purelymail — **DNS for email is never modified by this project**) |
| **Stack** | Astro 5 · Tailwind 3 · TypeScript · SSG |
| **Deploy** | Push `main` → **manual** build on VM → `/var/www/onenova` → nginx (see below) |

> **Important:** `git push` alone does **not** update https://onenova.in. After content changes, run the deploy steps in [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) and complete [deploy/POST_CHANGE_CHECKLIST.md](deploy/POST_CHANGE_CHECKLIST.md). Agents: read [AGENTS.md](AGENTS.md).

---

## Features

- Professional hero, About, Experience (timeline), Skills, Projects, Blog, Contact, Footer
- **Resume page** with downloadable PDF + print-friendly HTML
- **Markdown blog** (`src/content/blog`) with tags, search, reading time, RSS
- **Projects from GitHub** at build time (REST API) + curated fallbacks
- **GitHub stats & contribution graph** (GraphQL when `GITHUB_TOKEN` / `PERSONAL_GITHUB_TOKEN` is set; public chart fallback otherwise)
- **Certifications & achievements**
- **Newsletter placeholder** (static; wire to Buttondown/ConvertKit later)
- Contact form via **Formspree** or **mailto:** (nothing stored on the server)
- Dark / light mode, particles background, responsive layout
- SEO: Open Graph, Twitter cards, `robots.txt`, sitemap, JSON-LD, manifest, favicon, social image
- Performance-oriented: static HTML, hashed assets, lazy images, prefetch, gzip + long-cache nginx headers
- Accessibility: skip link, semantic landmarks, focus styles, reduced-motion respect

---

## Deploy (read this)

1. Push changes to `main` on GitHub.  
2. Deploy on the VM (or `./deploy/scripts/deploy-remote.sh` from a laptop that can SSH).  
3. Confirm https://onenova.in shows the change — **not** only the GitHub file.

Full guide: [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) · checklist: [deploy/POST_CHANGE_CHECKLIST.md](deploy/POST_CHANGE_CHECKLIST.md)

**2026-08-06 lesson:** RAC blog was on GitHub but missing from the live blog index until a manual deploy. Do not skip step 2–3.

---

## Repository tree

```text
onenova/
├── AGENTS.md               # rules for coding agents (push ≠ live)
├── .github/workflows/
│   ├── deploy.yml          # intended auto-deploy (needs onenova runner)
│   └── ci.yml              # PR build check
├── deploy/
│   ├── DEPLOYMENT.md       # how production works
│   ├── POST_CHANGE_CHECKLIST.md
│   ├── nginx/onenova.in.conf
│   └── scripts/
│       ├── setup-vm.sh     # one-time VM bootstrap
│       ├── deploy.sh       # rsync dist → web root (on VM)
│       └── deploy-remote.sh # SSH + build + rsync from laptop
├── public/
│   ├── favicon.svg
│   ├── favicon-32.png
│   ├── apple-touch-icon.png
│   ├── og-image.svg
│   ├── robots.txt
│   ├── site.webmanifest
│   ├── resume/Saurabh_Ahuja_Resume.pdf
│   └── images/projects/*.svg
├── src/
│   ├── components/         # UI building blocks
│   ├── content/
│   │   ├── config.ts
│   │   └── blog/*.md
│   ├── data/               # site, experience, skills, projects, certs
│   ├── layouts/BaseLayout.astro
│   ├── lib/                # github.ts, reading-time, utils
│   ├── pages/              # routes
│   ├── styles/global.css
│   └── env.d.ts
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

### Routes

| Path | Description |
|------|-------------|
| `/` | Home (hero + sections) |
| `/about` | Bio, timeline, education |
| `/experience` | Full experience timeline |
| `/skills` | Skill icons by category |
| `/projects` | GitHub + curated projects, stats |
| `/blog` | Post list, search, tags |
| `/blog/[slug]` | Post |
| `/blog/tags/[tag]` | Tag archive |
| `/resume` | PDF + HTML resume |
| `/certifications` | Certs & achievements |
| `/contact` | Email, socials, form |
| `/rss.xml` | RSS feed |
| `/sitemap-index.xml` | Sitemap (generated) |

---

## Prerequisites

### Local development

- Node.js **≥ 20**
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

### Production VM (already has Actions runner)

- Ubuntu / Debian / Oracle Linux on GCP
- Ports **80** and **443** open (GCP firewall + host firewall)
- DNS **A** (and optionally **AAAA**) for `onenova.in` and `www.onenova.in` → VM public IP
- **Do not change** MX / TXT / SPF / DKIM / DMARC used by Purelymail

---

## Local development

```bash
git clone https://github.com/saurabhahuja71/onenova.git
cd onenova
cp .env.example .env   # optional
pnpm install
pnpm dev               # http://localhost:4321
```

### Corporate proxy (Oracle)

`registry.npmjs.org` is often blocked. Use the HTTP proxy and npmmirror:

```bash
export http_proxy=http://www-proxy.us.oracle.com:80
export https_proxy=http://www-proxy.us.oracle.com:80
export HTTP_PROXY=http://www-proxy.us.oracle.com:80
export HTTPS_PROXY=http://www-proxy.us.oracle.com:80
export NODE_TLS_REJECT_UNAUTHORIZED=0

pnpm config set proxy http://www-proxy.us.oracle.com:80
pnpm config set https-proxy http://www-proxy.us.oracle.com:80
pnpm config set registry https://registry.npmmirror.com
pnpm config set strict-ssl false

pnpm install
pnpm build:fast
```

Build-time GitHub API calls use `curl -x $https_proxy` so projects/stats work behind the same proxy.

### Useful scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Dev server with HMR |
| `pnpm build` | Typecheck + production build → `dist/` |
| `pnpm build:fast` | Production build (used in CI) |
| `pnpm preview` | Serve `dist/` locally |
| `pnpm check` | `astro check` |

### Customize content

| File | What to edit |
|------|----------------|
| `src/data/site.ts` | Name, socials, nav |
| `src/data/experience.ts` | Jobs & education |
| `src/data/skills.ts` | Skills list |
| `src/data/projects.ts` | Curated project cards |
| `src/data/certifications.ts` | Certs & achievements |
| `src/content/blog/*.md` | Blog posts |
| `public/resume/Saurabh_Ahuja_Resume.pdf` | **Replace with your real PDF** |
| `.env` | GitHub username, Formspree, tokens |

### Optional env vars

```bash
PUBLIC_GITHUB_USERNAME=saurabhahuja71
PUBLIC_FORMSPREE_ID=xxxxxxxx        # formspree.io form id
PUBLIC_SITE_URL=https://onenova.in
# Build-time only (never commit secrets):
GITHUB_TOKEN=                       # or Actions GITHUB_TOKEN
PERSONAL_GITHUB_TOKEN=              # for contribution graph GraphQL
```

Create a Formspree form → set `PUBLIC_FORMSPREE_ID` (repo secret for CI). Without it, the contact form uses `mailto:saurabh@onenova.in`.

---

## Server setup (one time)

On the GCP VM (as a sudo-capable user, typically the same account running the Actions runner):

```bash
# Clone once if you want scripts on disk (Actions will also checkout)
git clone https://github.com/sauahuja/onenova.git ~/onenova
cd ~/onenova

chmod +x deploy/scripts/*.sh
sudo ./deploy/scripts/setup-vm.sh
```

The script installs **nginx**, **certbot**, ensures **Node/pnpm**, creates **`/var/www/onenova`**, installs the site config, requests **Let’s Encrypt** certs for apex + www, and grants the runner user **passwordless** `nginx -t` / `systemctl reload nginx`.

### Manual package install (if you prefer)

```bash
# Debian/Ubuntu
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx curl

# Node 20 (or use existing nvm)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
sudo corepack prepare pnpm@9.15.0 --activate

sudo mkdir -p /var/www/onenova /var/www/certbot
sudo chown -R "$USER:$USER" /var/www/onenova
```

### nginx

```bash
# Debian-style
sudo cp deploy/nginx/onenova.in.conf /etc/nginx/sites-available/onenova.in
sudo ln -sfn /etc/nginx/sites-available/onenova.in /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# RHEL / Oracle Linux
# sudo cp deploy/nginx/onenova.in.conf /etc/nginx/conf.d/onenova.in.conf

sudo nginx -t && sudo systemctl enable --now nginx
```

### HTTPS (Let’s Encrypt)

```bash
# After DNS A records point here — does NOT touch email DNS
sudo certbot --nginx -d onenova.in -d www.onenova.in \
  -m saurabh@onenova.in --agree-tos --redirect

# Renewal is automatic via certbot.timer / cron
sudo certbot renew --dry-run
```

**DNS checklist (website only):**

| Type | Name | Value |
|------|------|--------|
| A | `@` | VM public IP |
| A | `www` | VM public IP |

Leave Purelymail MX/TXT alone.

### GCP firewall

Allow ingress TCP **80** and **443** to the VM (or use the default “http-server” / “https-server” tags).

### Sudoers for deploy

`setup-vm.sh` installs `/etc/sudoers.d/onenova-deploy`. Manual equivalent:

```bash
echo "$USER ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx, /bin/systemctl is-active nginx" \
  | sudo tee /etc/sudoers.d/onenova-deploy
sudo chmod 440 /etc/sudoers.d/onenova-deploy
```

---

## Deployment (runner optional)

**You do not need a GitHub runner for this repo just to publish.**  
Manual build on the VM is enough. Full detail: **[deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md)**.

## How GitHub Actions deploy works

```text
git push → GitHub
         → self-hosted runner (this VM)
         → pnpm install
         → pnpm build:fast   (Astro SSG → dist/)
         → deploy/scripts/deploy.sh
              rsync dist/ → /var/www/onenova
              sudo nginx -t && sudo systemctl reload nginx
```

Workflow file: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

Triggers:

- Push to `main` / `master`
- Manual **workflow_dispatch**

### Runner

Your existing self-hosted runner must be **online** and listening for jobs labeled `self-hosted`. No GitHub-hosted minutes are required.

### Secrets (optional)

| Secret | Purpose |
|--------|---------|
| `PERSONAL_GITHUB_TOKEN` | GraphQL contribution calendar + higher API limits |
| `PUBLIC_FORMSPREE_ID` | Contact form backend |

`GITHUB_TOKEN` is provided automatically by Actions for public REST calls.

### Manual deploy

```bash
pnpm install
pnpm build:fast
./deploy/scripts/deploy.sh
```

---

## How HTTPS works

1. Browser requests `http://onenova.in` → nginx returns **301** to `https://…`
2. TLS terminates on nginx using certs in `/etc/letsencrypt/live/onenova.in/`
3. `www.onenova.in` **301**s to apex `https://onenova.in` (canonical)
4. Certbot renews certificates; nginx is reloaded on renew hooks
5. HSTS and security headers are set in the site config

Email continues to use Purelymail’s DNS; this stack only serves **HTTP(S)** for the website.

---

## Blog authoring

Create `src/content/blog/my-post.md`:

```md
---
title: "My post"
description: "Short summary for SEO and cards."
pubDate: 2026-07-29
tags: ["kubernetes", "go"]
featured: false
draft: false
---

Write in **Markdown**. Code fences work. Reading time is computed automatically.
```

- Drafts: set `draft: true` (excluded from build listings)
- Tags generate `/blog/tags/<slug>` pages
- RSS updates at `/rss.xml`

---

## Performance & Lighthouse notes

- Fully static HTML; no server runtime
- Tailwind purged CSS; Astro code-splitting + asset hashing
- `loading="lazy"` on images; viewport prefetch for in-site links
- nginx: gzip, immutable cache for `/_assets/`, short cache for HTML via `try_files`
- Prefer replacing remote Google Fonts with self-hosted files if you need offline fonts or stricter CSP

Target: **Lighthouse > 95** performance / accessibility / best practices / SEO on production HTTPS.

---

## Accessibility

- Skip-to-content link
- Semantic `header` / `main` / `nav` / `footer`
- Visible `:focus-visible` rings
- `prefers-reduced-motion` disables particles / long transitions
- Form labels and ARIA on theme / menu controls

---

## Future improvements

- [ ] Self-host Inter / JetBrains Mono (drop Google Fonts)
- [ ] Real analytics (Umami / GoatCounter / Plausible) instead of counter badge
- [ ] Wire newsletter to Buttondown or Listmonk
- [ ] Blog OG images generated per post
- [ ] View Transitions API for in-app navigation
- [ ] i18n if needed
- [ ] Automated Lighthouse CI
- [ ] Graphite / PR preview environments

---

## Security notes

- Static site only — no login, no database, no message storage on disk
- Contact: Formspree or mailto
- nginx security headers + TLS 1.2/1.3
- Never commit `.env` with tokens
- Sudoers file scopes only nginx test/reload

---

## License

MIT — personal site content © Saurabh Ahuja.

---

## Support

Questions: **saurabh@onenova.in**
