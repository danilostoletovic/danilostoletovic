# Cloudflare deployment

The existing production custom domain is attached to the `danilostoletovic` Worker. The `secretary` Worker uses `secretary.danilostoletovic.com` separately. The current site config uses static asset routing for HTML and generated files and runs the Worker first for `/mcp` and `/mcp/`.

## Prepare and verify

1. Use Node.js 24 and run `npm ci`, `npm run build`, `npm run check`, and `npm run check:worker`.
2. Run `npm run preview:worker`. From another terminal run `npm test` and `npm run verify:browser`.
3. In an approved deployment, point the existing Worker's build at this repository and run `npm ci && npm run build` followed by `npx wrangler deploy`. Keep the existing Worker name and apex custom domain. For an approved manual deployment, build with `INDEXNOW_DEPLOY_SHA` set to the full release commit before running Wrangler. Workers Builds otherwise supplies `WORKERS_CI_COMMIT_SHA`.
4. Verify a representative page, a legacy 301, a true 404, sitemap and robots MIME types, `/cv.pdf`, and `/mcp` using a Streamable HTTP client. Confirm Umami receives the expected page views and test one Ana question on the production origin.

`public/_headers` defines static security and cache policy. The build hashes the inline theme script into its Content Security Policy. `public/_redirects` maps historical paths to their closest English destinations. The apex has a Google Search Console verification TXT record. Preserve it. Supply the existing value of `GOOGLE_SITE_VERIFICATION` or `BING_SITE_VERIFICATION` as a build variable if the respective account uses HTML meta verification. Workers Assets uses its normal TLS and compression handling on the existing domain.

Cloudflare's zone settings showed AI crawler protection and AI category blocks disabled at review time. Bot Fight Mode was enabled. Verify representative legitimate crawlers after deployment and review challenged requests in Security Events if needed. The generated robots file allows public crawl access.

## MCP

The official MCP TypeScript SDK serves modern Streamable HTTP and the compatible 2025 initialization flow. No client credential is required. There are 13 read-only tools and 10 JSON resources. The Worker bundles a snapshot of the same typed data used by Astro, so a website deployment updates both formats together. MCP is stateless, returns uncached responses, limits request bodies to 16 KiB and lists to 30 items, and uses the native Cloudflare rate limit of 60 requests per minute per edge location and client IP.

Use `https://danilostoletovic.com/mcp` once deployed. The local equivalent is `http://127.0.0.1:8787/mcp`. Browser clients on additional trusted origins need an exact comma-separated `MCP_ALLOWED_ORIGINS` Worker variable. Native clients can omit the Origin header. Long-lived subscriptions are disabled. Requests from the same client share its rate limit across tools.

[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/binding/) · [Official SDK web runtimes](https://ts.sdk.modelcontextprotocol.io/v2/serving/web-standard) · [Protocol compatibility](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions)

## Ana

The commercial page sends questions to the existing Secretary `/chat` endpoint. Keep its API credential in that Worker and its Origin allowlist restricted to intended sites. For a permitted staging test, add the exact preview origin to Secretary or mock the network request locally. The browser keeps only a short in-memory transcript and offers the email address if the service cannot reply.

The Astro build exports `dist/ana-knowledge.json` with the curated public `profile`, `services`, and `projects` payloads. To synchronize a Secretary release, use those fields for Secretary’s `src/knowledge/profile.md`, `src/knowledge/services.json`, and `src/knowledge/projects.json`. Preserve Secretary’s policies and other private configuration, run its knowledge and chat tests, then release the separately approved Secretary build. No additional model provider or API key is required.

## IndexNow

The build retains the previous public key URL and publishes the immutable commit marker. The GitHub workflow can run on a successful GitHub `Production` deployment status or manually for a released commit. If the existing Workers Builds pipeline does not emit a GitHub deployment status, run the workflow manually after verifying the rollout or add a success bridge to the existing pipeline. The script checks the live commit marker, the exact key body, and all submitted canonical URLs before contacting IndexNow. Its default batch is the current sitemap. Pass a specific current canonical URL to submit one page.

No additional database, persistent store, or subscription is required. Static asset, MCP, log, and Ana usage remain subject to the existing Cloudflare and AI provider accounts.
