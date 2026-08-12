# Agent / contributor notes for onenova

Read this **before** claiming a site change is “done” or “live on onenova.in”.

## Deploy model: `git push` triggers auto-deploy

| Layer | What it means |
|-------|----------------|
| **GitHub** `saurabhahuja71/onenova` `main` | Source of truth for content and code |
| **GitHub Actions** `.github/workflows/deploy.yml` | Builds site on `ubuntu-latest`, rsyncs `dist/` to the VM, reloads nginx |
| **Live site** https://onenova.in | Static files on GCP VM under `/var/www/onenova` |

**Pushing to `main` auto-deploys https://onenova.in** (GitHub-hosted runner + SSH deploy key — no self-hosted runner needed).

- Repo secrets: `ONENOVA_SSH_HOST`, `ONENOVA_SSH_USER`, `ONENOVA_SSH_KEY`
- Deploy script: `deploy/scripts/deploy-remote-github.sh`
- Manual deploy still possible via `deploy/scripts/deploy-remote.sh`

### Incident (do not repeat)

**2026-08-06:** Oracle RAC blog was committed and pushed to GitHub. https://onenova.in/blog still showed only the Oracle Restart post because production was never rebuilt. Fix was manual deploy on the VM (see below). Lesson: **always verify the live URL after content changes.**

## After any change that should appear on the site

1. Commit and push to `main` on GitHub.
2. The **Deploy OneNova** workflow runs automatically (watch it under Actions).
3. **Verify live:**
   - Blog index: https://onenova.in/blog  
   - New post URL (example): https://onenova.in/blog/&lt;slug&gt;/  
   - Hard-refresh / check `last-modified` if Cloudflare caches
4. Only then tell the user the change is live.

### Manual deploy fallback (if Actions is down or you need it now)

From Oracle corp network, SSH needs corkscrew:

```bash
ssh -o "ProxyCommand=corkscrew www-proxy.us.oracle.com 80 %h %p" \
  -i ~/.ssh/id_ed255519 \
  sauahuja@136.67.97.86 \
  'cd ~/onenova-site && git fetch origin main && git reset --hard origin/main \
   && source ~/.nvm/nvm.sh && nvm use 20 \
   && PUBLIC_GITHUB_USERNAME=saurabhahuja71 pnpm install \
   && pnpm run build:fast \
   && rsync -a --delete dist/ /var/www/onenova/ \
   && sudo nginx -t && sudo systemctl reload nginx'
```

Or run [deploy/scripts/deploy-remote.sh](deploy/scripts/deploy-remote.sh) from a clone of this repo (if present).

Full detail: [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) · [deploy/POST_CHANGE_CHECKLIST.md](deploy/POST_CHANGE_CHECKLIST.md)

## Content model (blogs)

- New posts: `src/content/blog/<slug>.md` only — same collection as existing posts (e.g. Oracle Restart).
- Do **not** invent a separate personal “lab” GitHub repo for sample YAML unless the user explicitly asks. Prefer official Oracle samples (same pattern as the Restart post).
- Images for posts: `public/images/blog/`.
- Set `draft: false` and a real `pubDate` for published posts.

## Safety

- Do not reconfigure the Tradebots Actions runner for onenova.
- Do not touch Purelymail / email DNS records.
- Only write site files under `/var/www/onenova` on the deploy host.

## Verify before declaring success

```bash
# Live blog list must include the new slug
curl -sL https://onenova.in/blog/ | grep -oE 'provision-oracle-[a-z-]+' | sort -u

# Specific post returns 200 and expected title
curl -sI https://onenova.in/blog/<slug>/
curl -sL https://onenova.in/blog/<slug>/ | grep -oE '<title>[^<]+</title>'
```
