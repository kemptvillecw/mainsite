# KCW content integration: local review

This feature branch adds Read & Explore (`browse.html`), a shared article/story reader (`content.html?id=...`), and external-link guidance. Live content is disabled in `data/content.js` until the companion Content Handler API is deployed and verified from the real Dev hostname.

## Try the local demo

From this worktree, run:

```sh
npm run preview:content
```

Open http://127.0.0.1:4180/browse.html. The yellow banner identifies fictional sample data. The preview listens only on this computer. Stop it with Ctrl+C. No sign-in, database writes, or Google API credentials are involved. Running `node dev-tools/serve.mjs` without `--demo` uses the actual checked-in configuration and shows the preparation message while disabled. Sample data is never used as a fallback for live failures.

Try type/author/tag combinations, date ranges, Next/Previous, browser Back, and Clear all. Open an article and a story. Check narrow-screen navigation and the external-link notice. External sample links go to example.com.

## Automated checks

Use Node 20+ with Playwright available. Set `PLAYWRIGHT_PATH` to an existing Playwright installation if it is not locally installed, then run `npm run test:content`. The default browser channel is installed Microsoft Edge; set `BROWSER_CHANNEL` for another installed channel. Tests start their own loopback server on port 4191, check filters/history/pagination, failed-refresh recovery, safe text rendering, deferred reader edits, withdrawal, external-link attributes, and mobile overflow. Screenshots go to ignored `artifacts/`.

The dependency-free browser contract (`scripts/public-content-contract.js`) and demo query engine (`dev-tools/public-content-service.mjs`) are copies from the Content Handler repository's `shared/` directory. Update those copies together when the wire contract or query behavior changes. The demo engine is not imported by live pages. Existing events remain independent.

## Live activation is still pending

The companion backend branch is `impishlycreative/content_handler:feature/kcw-public-content`. Its `integration/README.md` documents API deployment, the default-off `CMS_PUBLIC_API_ENABLED` flag, author migration, performance limits, and rollout checks.

After deploying the API, verify anonymous browser requests from the actual KCW Dev hostname follow Google's redirect and return valid JSON. Verify private IDs are unavailable; published additions/removals appear within one minute; draft edits preserve the approved copy; author/tag renames retain filters; and actual image files resolve. Check catalogue latency under the 15-second request timeout. Local demo tests do not establish any of these live-service results. Then update the public endpoint if needed and enable `data/content.js` in a reviewed change.

The website refreshes visible listings every 30 seconds and on returning to a tab. Reader text updates require an explicit reload; confirmed removal clears it. A failed refresh preserves the visible copy with an out-of-date notice.

Existing approved content needs an attribution backfill to appear under author filters. Hero images must already exist under this site's `images/` directory; missing images hide gracefully. Structured editor changes, inline-image authoring, and image synchronization remain later work. No live Google screening claim is made by the link notice.

Merging to `dev` activates the existing workflow that mirrors to `kemptvillecw/dev`. This branch has not been merged or deployed. Review locally before promotion to Dev, then UAT and production.

## Review to-do list

- [x] Change the Link button label to “View website ↗”.

## Activation — 2026-09-27

Backend PR #21 is merged and deployed as Apps Script version 8, with CMS_PUBLIC_API_ENABLED=true. Anonymous requests from https://kemptvillecw.github.io/dev/ successfully validated the live listing, article detail, a missing ID, and the Link filter. The catalogue currently contains one approved Article, with no author attribution, and no Links. The website configuration is now enabled. Publication/removal timing and existing author migration still need separate live acceptance checks; no content was created or withdrawn during deployment verification.
