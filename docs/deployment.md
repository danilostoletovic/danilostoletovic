# Cloudflare deployment

The production custom domain is attached to the `danilostoletovic` Worker. The `secretary` Worker uses `secretary.danilostoletovic.com` separately. Workers Assets publishes the built site. The configured Worker-first routes handle MCP, A2A, and Accept negotiation on canonical pages. Direct discovery and Markdown URLs use static assets.

## Prepare and verify

1. Use Node.js 24 and run `npm ci`, `npm run build`, `npm run check`, and `npm run check:worker`.
2. Run `npm run preview:worker`. From another terminal run `npm test`, `npm run verify:browser`, and `npm run verify:webmcp`. Run `npm run verify:determinism` before starting the preview or after shutting it down.
3. The production Workers Builds trigger watches `main` from the repository root. Workers Builds installs dependencies from the lockfile. Set its Build command to `npm run build` so Astro generates `dist/` before the Deploy command, `npx wrangler deploy`. Keep the existing Worker name and apex custom domain. Workers Builds supplies `WORKERS_CI_COMMIT_SHA`. For a manual deployment, set `INDEXNOW_DEPLOY_SHA` to the full release commit before building and running Wrangler.
4. After release, set `VERIFY_URL=https://danilostoletovic.com` in the verification terminal and run `npm test`, `npm run verify:browser`, `npm run verify:webmcp`, and `npm run verify:analytics`. The analytics check loads one real homepage visit and requires the Umami collector to accept it. Capture the production `Link`, `Vary`, `Content-Type`, `Content-Encoding`, `Content-Signal`, and CSP headers for HTML and Markdown requests. Check the deployment commit marker and run a fresh [Cloudflare agent-readiness scan](https://isitagentready.com/).

`src/config/security.ts` defines the security policy. Astro generates `dist/_headers` with the inline theme's SHA-256 hash. Cloudflare's documented `Cache-Control: no-transform` opt-out suppresses JavaScript Detections injection on canonical HTML. It can affect edge compression and other HTML injectors, so compare the released homepage's `Content-Encoding`, transfer size, and Cloudflare Web Analytics beacon behavior. The CSP allows the existing beacon by path and proxied RUM submissions use the same origin. `public/_redirects` maps historical URLs. Preserve the existing Google Search Console verification TXT record and optional `GOOGLE_SITE_VERIFICATION` or `BING_SITE_VERIFICATION` build variables. [Cloudflare JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/) · [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/faq/) · [Cloudflare compression](https://developers.cloudflare.com/speed/optimization/content/compression/)

### Cloudflare crawler and edge settings

- In the zone, open **Security → Settings**, filter by **Bot traffic**, and keep **Managed robots.txt** and **Bot Preference Sync** off so the generated robots file controls usage preferences. The API showed both off on November 26, 2026. [Managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)
- In **Security → Settings → Bot traffic → AI Crawler and Agent access policies**, retain access for public training, search, and user-initiated AI traffic. Review named crawlers in **AI Crawl Control → Crawlers** and confirm that intended crawlers show **Allow**. AI category protection flags were disabled at review time. [Crawler and agent access policies](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/) · [Manage AI crawlers](https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/)
- Retain Bot Fight Mode and check **Security → Analytics → Events** if legitimate crawlers receive a challenge. The zone uses the Free plan, whose Bot Fight Mode operates outside WAF Skip rules and automatically enables JavaScript Detections. Verify that canonical HTML responses carry `no-transform` and that DevTools reports zero CSP issues after release. [Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- Keep Cloudflare's zone Markdown conversion inactive for this application. The Worker serves curated build-time Markdown and caches each asset under a distinct key. Cloudflare's native converter performs on-request HTML conversion and is available to Pro, Business, Enterprise and SSL for SaaS customers. Review Cache Rules for any override that forces `no-store` responses into a shared cache. [Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
- The existing DNSSEC-validated record is `_index._agents SVCB 1 danilostoletovic.com. alpn=h2 port=443`. For optional known-agent publication after approval, run `npm run dns:aid` and use **DNS → Records → Add record → TXT**. Use the apex `@` and TTL 300 seconds, with one TXT record per protocol. Follow the generated quoting for each record's character strings, preserve the existing SVCB and verification records, then verify the new TXT answers from a DNSSEC-validating resolver. [DNS-AID draft](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dawn-dnsaid-00) · [Cloudflare DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/)

## Profile photograph

Replace `assets/danilo-stoletovic.png` with the new portrait and run `npm run build`. The image endpoint writes the square AVIF, WebP, and JPEG variants into `dist/images/` using Sharp. Use an 800 × 800 or larger square source to fill the frame. The encoder preserves the full photo and removes source metadata. Edit the text in `person.image` in `src/data/public.ts` if the replacement needs a different description. The profile data supplies the public JPEG URL to generated identity formats, and `src/data/portrait.ts` defines the filenames and responsive sizes.

## MCP

The official MCP TypeScript SDK serves modern Streamable HTTP and the compatible 2025 initialization flow. No client credential is required. There are 13 read-only tools and 10 JSON resources. The Worker bundles a snapshot of the same typed data used by Astro, so a website deployment updates both formats together. MCP is stateless, returns uncached responses, limits request bodies to 16 KiB and lists to 30 items, and uses the native Cloudflare rate limit of 60 requests per minute per edge location and client IP.

Use `https://danilostoletovic.com/mcp`. The local equivalent is `http://127.0.0.1:8787/mcp`. The new Server Card is served at `/mcp/server-card` and published through ARD and the experimental MCP AI Catalog. Its namespaced server identity is `com.danilostoletovic/danilo-professional-profile`. Clients that pin the previous server name should update their configuration. Browser clients on additional trusted origins need an exact comma-separated `MCP_ALLOWED_ORIGINS` Worker variable. Native clients can omit the Origin header. Long-lived subscriptions are disabled. Requests from the same client share its rate limit across tools.

[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/binding/) · [Official SDK web runtimes](https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard) · [Protocol compatibility](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)

## A2A

Clients fetch `/.well-known/agent-card.json` and send standalone text messages to `POST /a2a/message:send` with `A2A-Version: 1.0` and `Content-Type: application/a2a+json`. The Worker answers from the same public catalogue as MCP. It accepts bounded messages without credentials, uses a separate limiter of 30 requests per minute per edge location and IP, and returns source links and structured A2A errors. A response uses `ROLE_AGENT` and a text part. This body looks up SmartVehicle.

```json
{"message":{"messageId":"query-1","role":"ROLE_USER","parts":[{"text":"projects: SmartVehicle"}]}}
```

Standalone requests consume Worker execution only. The Secretary chat remains the interactive, model-backed assistant. [A2A HTTP+JSON binding](https://a2a-protocol.org/v1.0.1/specification/#11-httpjsonrest-protocol-binding)

## Ana

The commercial page sends questions to the existing Secretary `/chat` endpoint. Keep its API credential in that Worker and its Origin allowlist restricted to intended sites. For a permitted staging test, add the exact preview origin to Secretary or mock the network request locally. The browser keeps only a short in-memory transcript and offers the email address if the service cannot reply.

The Astro build exports `dist/ana-knowledge.json` with the curated public `profile`, `services`, and `projects` payloads. To synchronize a Secretary release, use those fields for Secretary’s `src/knowledge/profile.md`, `src/knowledge/services.json`, and `src/knowledge/projects.json`. Preserve Secretary’s policies and other private configuration, run its knowledge and chat tests, then release the separately approved Secretary build. No additional model provider or API key is required.

## IndexNow

Set a persistent `INDEXNOW_KEY` in the Worker’s **Build** environment variables and in the repository’s **Actions secrets**. Use the same value in both places. Reuse the previously deployed key to keep its verification URL, or generate a new one with `openssl rand -hex 32`. The key accepts 8–128 letters, digits, or hyphens. Wrangler runtime variables are unnecessary. Local builds can set `INDEXNOW_KEY` in the shell to generate and test the exact root-level verification file.

Astro builds `/indexnow-manifest.json` from the same canonical pages as the XML sitemap. Each URL has a deterministic SHA-256 fingerprint of its rendered HTML and negotiated Markdown. The manifest includes the deployment commit and is served with `no-store` and `noindex`.

A push to `main` starts the GitHub Actions workflow, which waits up to six minutes for the corresponding release marker and manifest on the production domain. Successful GitHub Production deployment statuses also trigger it when available. The hourly run reconciles the current live release after a slow build, missed wake-up, or submission failure. **Run workflow** on the default branch to reconcile immediately. A release already superseded on the live domain is reconciled through the newer live manifest.

The first run submits the live sitemap’s canonical URLs. Subsequent runs compare the live manifest with the last accepted URL fingerprints on the workflow-managed `indexnow-state` branch. The workflow verifies the key file and changed live canonical pages, sends removed URLs alongside additions and updates, and saves each accepted batch. Identical fingerprints produce no submission. Keep the state branch writable by GitHub Actions and outside the Cloudflare production or preview branches. If GitHub cannot persist an accepted batch, a later run may send it again.

The workflow uses the built-in GitHub token. Static asset, MCP, log, and Ana usage remain subject to the existing Cloudflare and AI provider accounts.
