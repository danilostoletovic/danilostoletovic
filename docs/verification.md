# Local verification

## Homepage performance

Lighthouse 13.6.0 ran two comparisons in Chromium 156. Both compared the original Astro checkout at `e18d8ec` with the rebuilt homepage on the same loopback static server. Both blocked external analytics to keep the comparison reproducible. The table shows the range of the two runs. These are lab measurements.

| Metric | Mobile baseline | Mobile rebuild | Desktop baseline | Desktop rebuild |
| --- | ---: | ---: | ---: | ---: |
| Performance | 88–99 | 98–99 | 100 | 100 |
| Accessibility | 95 | 100 | 95 | 100 |
| Best practices | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| First Contentful Paint | 0.76 s | 0.80–0.83 s | 0.21 s | 0.24–0.25 s |
| Largest Contentful Paint | 2.11–3.91 s | 1.53 s | 0.51–0.79 s | 0.43 s |
| Cumulative Layout Shift | 0.001 | 0 | 0.006 | 0 |
| Total Blocking Time | 35–66 ms | 92–174 ms | 0 ms | 0 ms |
| Total byte weight | 601 kB | 73 kB | 601 kB | 73 kB |

The homepage transferred 88% fewer bytes and reached LCP earlier. Mobile FCP and blocking time were higher in these lab samples. Check production field LCP, INP, and CLS after release.

To repeat the comparison, keep a build of the original checkout in `.research/baseline/`, build the current site into `dist/`, and run `npm run audit`. The audit writes Lighthouse reports and a summary to `.research/lighthouse/`.

## Functional checks

- Astro build, strict type checking, Node syntax checks and Wrangler dry run passed.
- Playwright and axe passed 24 page and viewport combinations. Checks covered 1440 px light, 390 px dark, and 320 px light layouts, CSP, internal links and anchors, keyboard access, manual theme persistence, and navigation with JavaScript disabled.
- The printable HTML CV and one-page A4 PDF share their data. The PDF was rendered and visually inspected.
- The Worker served matching canonical URLs and JSON-LD across the sitemap, correct artifact MIME types, historical 301s, and a genuine 404.
- The final external link check reached 35 of 38 distinct catalogue destinations. LinkedIn, Fiverr Pro, and Upwork restricted automated requests. The check found zero missing destinations.
- The official MCP client negotiated the July 2026 revision and exercised all 13 tools and 10 resources. The resource data matched the generated JSON snapshot. A separate 2025 handshake, invalid inputs, unknown tools and resources, origin validation, oversized streams and uncached responses passed. The local rate limiter returned HTTP 429 and `Retry-After: 60` after 60 requests from a synthetic test address.
- The budget planner produced scope examples and a prefilled inquiry. The browser tested an Ana reply and the email fallback with a mock. One live request to the existing Secretary Worker from the production origin returned a services answer. The rebuilt page translates the older services anchor in that answer.

The production release, search-engine submission, live analytics event delivery, and rollout of the generated Secretary knowledge remain release steps. [Deployment runbook](deployment.md)
