# Point tyrox.net (GoDaddy) → GitHub Pages

Repo: https://github.com/SalmanTayyab454/tyrox

## 1. Enable Pages

GitHub → **Settings → Pages**

- Source: **Deploy from a branch**
- Branch: **main** / **/ (root)**
- Custom domain: **tyrox.net**
- After DNS verifies: **Enforce HTTPS**

## 2. GoDaddy DNS

My Products → Domains → **tyrox.net** → DNS

| Type  | Name | Value                      | TTL |
|-------|------|----------------------------|-----|
| A     | @    | 185.199.108.153            | 600 |
| A     | @    | 185.199.109.153            | 600 |
| A     | @    | 185.199.110.153            | 600 |
| A     | @    | 185.199.111.153            | 600 |
| CNAME | www  | SalmanTayyab454.github.io  | 600 |

Remove conflicting GoDaddy parking/forwarding A records on `@`.
