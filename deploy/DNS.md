# DNS notes for onenova.in

## Website records (required)

Point these to your GCP VM public IP. **Do not** alter Purelymail email records.

| Type | Host | Value | TTL |
|------|------|--------|-----|
| A | `@` (apex) | `<GCP_VM_PUBLIC_IP>` | 300–3600 |
| A | `www` | `<GCP_VM_PUBLIC_IP>` | 300–3600 |

Optional:

| Type | Host | Value |
|------|------|--------|
| AAAA | `@` / `www` | VM IPv6 if enabled |

## Email records (Purelymail — leave alone)

Typical Purelymail records (examples only — keep whatever Purelymail documents for your domain):

- `MX` → Purelymail mail exchangers
- `TXT` SPF
- `TXT` / `CNAME` DKIM
- `TXT` DMARC

This project’s nginx/certbot setup only uses **HTTP-01** challenges on ports 80/443. It never writes MX/TXT.

## Verification

```bash
dig +short onenova.in A
dig +short www.onenova.in A
dig +short onenova.in MX   # should still show Purelymail
curl -I http://onenova.in   # expect 301 → https
curl -I https://onenova.in  # expect 200
```
