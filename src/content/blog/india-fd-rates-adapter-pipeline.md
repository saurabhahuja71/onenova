---
title: "India FD Rates: Ranking Callable Retail Deposits with Fail-Closed Bank Adapters"
description: "How India-FD-Rates scrapes official bank pages with per-bank adapters, excludes non-callable products, fails closed on bad parses, and publishes daily rankings via GitHub Actions and Pages."
pubDate: 2026-09-06
author: "Saurabh Ahuja"
tags:
  - india-fd-rates
  - fixed-deposit
  - python
  - web-scraping
  - github-actions
  - data-engineering
  - personal-finance
featured: true
draft: false
heroImage: "/images/blog/india-fd-rates/01-pipeline-overview.svg"
---

“Highest FD rate in India” is an easy headline and a hard data problem. Bank pages mix callable and non-callable products, special tenures, senior-citizen columns, PDFs, and HTML tables that change without notice. A scraper that guesses when a parse fails will quietly publish the wrong number.

[India-FD-Rates](https://github.com/saurabhahuja71/India-FD-Rates) is a small public pipeline that ranks **callable resident domestic retail** fixed-deposit rates from official bank sources, fails closed when evidence is missing, and republishes daily through GitHub Actions and [GitHub Pages](https://saurabhahuja71.github.io/India-FD-Rates/).

![India FD Rates daily collection pipeline](/images/blog/india-fd-rates/01-pipeline-overview.svg)

## What you will achieve

- Understand the ranking policy (callable retail only, by bank category)
- See how `config/banks.yaml` and per-bank adapters work together
- Run the updater locally and read failure / audit artifacts
- See how Actions validates, commits, and deploys Pages

## Architecture

| Path | Role |
|------|------|
| `config/banks.yaml` | Bank registry: category, enabled flag, official HTML/PDF URLs |
| `scripts/banks/*.py` | One adapter per bank (or a shared helper) |
| `scripts/update_rates.py` | Daily fetch + promote-or-fail loop |
| `data/fd-rates.json` | Published snapshot used by the site and README |
| `data/fetch_failures.json` | Exact failure stage, HTTP metadata, reason |
| `data/ranking_audit.json` | Machine-readable ranking decisions |
| `verification_report.md` | Human-readable audit of who ranked and why |
| `.github/workflows/update-fd-rates.yml` | Schedule, tests, validate, commit, Pages deploy |

The design goal is boring reliability: a broken bank must not invent a rate, and a healthy bank must leave a trail from official URL to ranked row.

## Ranking policy

The published Top-N lists use the **highest eligible callable resident-domestic-retail** FD rate, including callable special-tenure schemes (for example 444/555-day products). Rankings are split into:

- Private sector
- Public sector
- Small finance

**Excluded from the main ranking:** non-callable, bulk, NRI-only, and institutional products. Product details can still appear in bank evidence and inventory pages; they simply do not compete for the headline table.

Coverage is reported honestly. If only six of twelve public-sector banks verify on a given day, the README says so instead of padding the list with stale guesses.

## Bank registry and adapters

Each enabled bank is a registry row. Adapters can target HTML tables, structured HTML, official PDFs, or endpoints without sharing one brittle site-wide regex.

```yaml
banks:
  - id: hdfc
    name: HDFC Bank
    category: private_sector
    parser: hdfc
    enabled: true
    deposit_category: Domestic retail deposit
    retail_threshold: Below ₹3 crore
    official_sources:
      - {type: html, url: https://www.hdfc.bank.in/fixed-deposit/fd-interest-rate}

  - id: 'yes'
    name: Yes Bank
    category: private_sector
    parser: 'yes'
    enabled: true
    official_sources:
      - {type: html, url: https://www.yes.bank.in/personal-banking/yes-individual/deposits/fixed-deposit}
      - {type: pdf, url: 'https://www.yes.bank.in/.../yb_interest_rates_on_savings_account_n_term_deposit_1jan2026.pdf?download=false'}
```

An adapter’s job is narrow: fetch the configured official source(s), locate tenure-linked regular and senior rates, and return a structured result — or raise. Shared helpers in `scripts/banks/base.py` parse HTML tables and reject rows that look like bulk, institutional, or non-callable noise.

![Fail-closed adapter success and failure paths](/images/blog/india-fd-rates/02-adapter-fail-closed.svg)

### Fail closed

When every official source for a bank fails (HTTP 403/404, missing retail section, headline rates without tenure rows), the bank is marked `FAILED`, excluded from the current ranking, and recorded in `data/fetch_failures.json` with the attempted URL, status, parser stage, and reason.

Real examples from a recent run:

- **ICICI Bank** — page returned 200, but only headline rates without tenure-linked retail rows → failure stage `retail_section_detection`
- **Bank of India** — official pages returned HTTP 403 to the automation runner → not ranked
- **Indian Bank** — configured URL redirected to a 404 → `source_fetch` failure

A failed adapter affects only that bank. Other banks still publish.

## Daily automation

The workflow runs on a schedule (`30 2 * * *` UTC) and on `workflow_dispatch`:

1. Install `pyyaml` and `pypdf`
2. Run adapter fixture unit tests
3. Run `scripts/update_rates.py`
4. Validate with `scripts/validate_data.py`
5. Generate ranking audit and bank inventory reports
6. Commit changed data / README / site files when the diff is non-empty
7. Deploy the repository root to GitHub Pages

Fixture tests run **before** live fetches so a broken parser change fails in CI instead of shipping a bad table.

After a successful data update, `scripts/update_readme.py` regenerates only the marked `<!-- FD_TABLES_START -->` … `<!-- FD_TABLES_END -->` section in the README. The ranking tables are not hand-edited.

## Try it locally

```bash
git clone https://github.com/saurabhahuja71/India-FD-Rates.git
cd India-FD-Rates
python3 -m pip install --disable-pip-version-check pyyaml pypdf

PYTHONPATH=scripts python3 -m unittest discover -s tests -v
python3 scripts/update_rates.py
python3 scripts/validate_data.py
python3 scripts/generate_reports.py

python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000), then inspect:

- `verification_report.md` — who is LIVE vs FAILED and why
- `data/fetch_failures.json` — repair queue for adapters
- `data/ranking_audit.json` — machine-readable ranking decisions
- `all-banks.html` — full inventory beyond the Top-N tables

Live Pages: [saurabhahuja71.github.io/India-FD-Rates](https://saurabhahuja71.github.io/India-FD-Rates/)

## Lessons learned

1. **One adapter per bank** beats a mega-regex. Bank HTML and PDF layouts diverge; isolation keeps a Yes Bank PDF change from breaking HDFC.
2. **Fail closed beats a wrong number.** Dropping a bank from the ranking is better than publishing a stale or invented rate.
3. **PDF and HTML sources both matter.** Some banks still publish the authoritative card only as a PDF.
4. **Coverage honesty builds trust.** Partial public-sector coverage is fine if the README says `6 / 12` instead of implying a full census.
5. **Regenerate, don’t hand-edit rankings.** Marker-bounded README updates keep the GitHub landing page and JSON snapshot aligned.

## Disclaimer

Figures are indicative annual rates for eligible resident retail deposits, not investment advice. Always confirm the rate, eligibility, amount limit, callable status, special-scheme end date, and booking date on the linked official bank page before investing. The project uses no referral or promotional links.

## Links

- Repository: [github.com/saurabhahuja71/India-FD-Rates](https://github.com/saurabhahuja71/India-FD-Rates)
- Live rankings: [saurabhahuja71.github.io/India-FD-Rates](https://saurabhahuja71.github.io/India-FD-Rates/)
- Verification report in-repo: `verification_report.md`

A sibling project, [India-Home-Loan-Rates](https://github.com/saurabhahuja71/India-Home-Loan-Rates), applies the same adapter and verification pattern to advertised floating home-loan starting rates — a natural follow-up when lender pages are even messier than FD tables.
