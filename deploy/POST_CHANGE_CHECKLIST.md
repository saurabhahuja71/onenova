# Post-change checklist (onenova.in)

Use this every time you change content or site code that should appear on **https://onenova.in**.

## Why this exists

**GitHub `main` ≠ live website.**  
Production is a static tree on `136.67.97.86` at `/var/www/onenova`. Auto-deploy via Actions is **not** currently wired to a runner for this repo (see [DEPLOYMENT.md](./DEPLOYMENT.md)).

**Past mistake (2026-08-06):** Blog post pushed to GitHub; https://onenova.in/blog still outdated until manual deploy.

## Checklist

- [ ] Change is in the right place (`src/content/blog/*.md` for posts, not a random extra repo)
- [ ] Local or CI build succeeds (`pnpm run build:fast` or `pnpm run build`)
- [ ] Committed and **pushed** to `main` on https://github.com/saurabhahuja71/onenova
- [ ] **Manual deploy** completed on the VM (or Actions deploy job actually succeeded)
- [ ] Live check: https://onenova.in/blog (or relevant page) shows the change
- [ ] Live check: direct post URL returns 200 and correct title
- [ ] If something looks stale: hard-refresh; re-check VM `last-modified` / rsync timestamp

## Deploy (copy/paste)

SSH (Oracle network):

```bash
ssh -o "ProxyCommand=corkscrew www-proxy.us.oracle.com 80 %h %p" \
  -i ~/.ssh/id_ed255519 \
  sauahuja@136.67.97.86
```

On the VM:

```bash
cd ~/onenova-site
git fetch origin main && git reset --hard origin/main
source ~/.nvm/nvm.sh && nvm use 20
export PUBLIC_GITHUB_USERNAME=saurabhahuja71
pnpm install
pnpm run build:fast
rsync -a --delete dist/ /var/www/onenova/
sudo nginx -t && sudo systemctl reload nginx
ls /var/www/onenova/blog/
```

From laptop (single remote command):

```bash
./deploy/scripts/deploy-remote.sh
```

## Live verification

```bash
curl -sL https://onenova.in/blog/ | grep -iE 'rac|restart|href="/blog/' | head -30
curl -sI "https://onenova.in/blog/<your-slug>/"
curl -sL "https://onenova.in/blog/<your-slug>/" | grep -oE '<title>[^<]+</title>'
```

## Definition of done

A content change is **done** only when:

1. It is on GitHub `main`, **and**
2. The public URL reflects it.
