# Sitemap Architecture

## Public files

- `/sitemap_index.xml` is the only sitemap declared in `robots.txt`.
- `/sitemaps/sitemap_pages.xml` contains canonical static pages.
- `/sitemaps/sitemap_kategori.xml` contains canonical category landing pages.
- `/sitemaps/sitemap_video_YYYY-MM-DD_N.xml` contains rolling video entries.

The active video inventory is capped at 45,000 unique IDs and retained for no
longer than 90 days. Video shards contain at most 5,000 URLs each, stay below
45 MB, and use `/v/{id}-{slug}` as the canonical watch URL.

## Automation

GitHub Actions runs `.github/workflows/sitemap-daily.yml` every day at 03:17
Asia/Jakarta and can also be started manually. It scans the first 100 pages of
the upstream latest feed, retries temporary failures, validates every generated
file, and commits directly to `main` only when the published sitemap changes.

No Vercel Function or Vercel Cron is used. CI-only scripts and state are omitted
from deployments through `.vercelignore`.

## Local commands

```text
generate-sitemap.bat validate
generate-sitemap.bat daily
generate-sitemap.bat bootstrap
```

Use `bootstrap` only to rebuild the initial 45,000-URL inventory. Normal updates
must use `daily`. A failed fetch or validation exits non-zero and must never be
committed.
