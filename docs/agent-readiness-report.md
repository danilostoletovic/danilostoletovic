# Agent readiness verification

The candidate preserves the Astro portfolio and its public catalogue. Each build generates 30 canonical Markdown representations, 18 discovery files, typed public JSON, RSS, a sitemap, crawler policy and Cloudflare headers. Anonymous MCP and A2A run in the existing Worker. The changes are ready for release verification on `danilostoletovic.com`. See the [artifact inventory](agent-artifacts.md) and [Cloudflare deployment runbook](deployment.md).

## Production baseline

On November 26, 2026, Cloudflare's public scanner rated the live site **Level 1, Basic Web Presence**. It detected robots.txt, sitemap, wildcard AI bot access, and a DNSSEC-validated DNS-AID organization record. It did not detect Content Signals, Markdown negotiation, discovery Link headers, an API catalog, Skills Index, MCP Server Card, WebMCP, or A2A. Its ARD check reported missing discovery. A direct follow-up returned 200 and JSON at the live ARD path, and local Lighthouse recognized that starting manifest. The old manifest contained one inline MCP entry. These observations describe the live baseline and the local starting build at `822cb9f`. A fresh public scanner result requires deploying the candidate. [Cloudflare scanner](https://isitagentready.com/)

Chromium received HTTP 200 from the production Umami `POST https://gateway.umami.is/api/send` collector. The initial Umami CSP correction was already active in the deployed homepage's single enforced policy. The theme's inline hash matched the live script. Chromium still reported two separate CSP violations from Cloudflare edge injection. It blocked the inline JavaScript Detections loader and the Cloudflare Web Analytics beacon. The generated candidate policy explicitly configures the Umami collector, preserves the website ID and Secretary connection, removes the former Umami gateway, and allows the documented beacon script by path. Canonical HTML opts out of the incompatible JavaScript Detections injection using Cloudflare's documented `no-transform` response directive. The release verification includes production CSP, RUM, and encoding because the local Worker does not inject those edge scripts. [Umami Cloud tracker](https://docs.umami.is/docs/bypass-ad-blockers) · [Cloudflare JavaScript Detections](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/) · [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/faq/)

## Level 1

| Check | Status | Implementation and verification | Runtime, release and cost |
| --- | --- | --- | --- |
| Content Signals | Implemented but awaiting deployment | Build applies `search=yes, ai-input=yes, ai-train=yes` consistently to robots.txt and the HTTP `Content-Signal` header. Both passed the local HTTP check. [Content Signals Policy](https://contentsignals.org/) | Static, no added fixed cost. Publish the generated files and confirm the managed policy in the zone. |
| Markdown negotiation | Implemented but awaiting deployment | RFC 9110 media range and quality handling at all 30 canonical pages. Tests cover Markdown, HTML, equality and quality ordering, wildcards, zero quality, HEAD, 404, 406, Vary, ETags and canonical links. [RFC 9110 §12](https://www.rfc-editor.org/rfc/rfc9110.html#name-content-negotiation) | One Worker selection on canonical routes. Prebuilt assets use separate cache keys. Negotiated Markdown carries `private, no-store`. Verify at the edge after release. |
| robots.txt | Implemented but awaiting deployment | Generated RFC 9309 rules permit the public catalogue, omit Cloudflare's internal `/cdn-cgi/` paths and point to the canonical sitemap. Exact content is checked at build and over HTTP. [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) | Static, no added fixed cost. |
| Sitemap | Implemented and verified | Clean builds generate a valid Sitemaps 0.9 URL set from canonical Astro pages. XML and all canonical targets passed. Modification dates require a trustworthy page modification source. [Sitemaps protocol](https://www.sitemaps.org/protocol.html) | Static, no added fixed cost. The updated build publishes its own sitemap. |
| AI crawler rules | Implemented and verified | Read-only Cloudflare zone inspection found managed robots.txt and preference sync disabled, AI categories unblocked, and Bot Fight Mode enabled. Requests using GPTBot, ClaudeBot, and Googlebot user-agent strings received HTTP 200 from the production robots URL. Verified-crawler classification and Security Events are separate release checks. [Manage AI crawlers](https://developers.cloudflare.com/ai-crawl-control/features/manage-ai-crawlers/) | Existing Cloudflare plan and bot controls. Dashboard verification steps are in the runbook. |

## Level 2

| Check | Status | Implementation and verification | Runtime, release and cost |
| --- | --- | --- | --- |
| API catalog | Implemented but awaiting deployment | Generated `/.well-known/api-catalog` uses RFC 9727 and RFC 9264 `application/linkset+json`. Eleven anonymous JSON GETs match OpenAPI 3.1.1; MCP and A2A are identified by their own service metadata. The validator tests actual JSON payloads against the described types. [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) · [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) | Static, no added fixed cost. |
| Link headers | Implemented but awaiting deployment | Generated RFC 8288 headers advertise `api-catalog`, `ard`, `service-meta`, Markdown `alternate` and HTML `canonical` as applicable. The local Wrangler runtime served them. [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | Static Assets rules with live read-back after deploy. |
| Auth.md | Not applicable | WorkOS Auth.md describes agent registration and credential acquisition. Public service access is anonymous. The historical `/auth.md` link is a redirect to public integration documentation. [Auth.md protocol](https://github.com/workos/auth.md) | No auth runtime or cost. |

## Level 3

| Check | Status | Implementation and verification | Runtime, release and cost |
| --- | --- | --- | --- |
| OAuth discovery | Not applicable | The site has no OAuth authorization server. [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) | No OAuth configuration, runtime or cost. |
| OAuth protected resource | Not applicable | Public read endpoints require zero credentials. [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) | No resource authentication runtime or cost. |
| A2A Agent Card | Implemented but awaiting deployment | Generated Agent Card at `/.well-known/agent-card.json` from the capability registry. Real HTTP+JSON 1.0 traffic at `/a2a/message:send` returned standalone text with public sources. Request validation, version rejection, origin policy, body limit and task errors passed locally. [A2A 1.0.1](https://a2a-protocol.org/v1.0.1/specification/) | Read-only lookup, 8 KiB body cap and a 30/minute per-IP edge rate limit. Worker usage only. No added inference calls. |
| Skills Index | Implemented but awaiting deployment | Index and 10 generated `SKILL.md` documents follow the Agent Skills Discovery draft 0.2.0. Structure, names, frontmatter and individual SHA-256 digests passed. [Cloudflare's draft](https://github.com/cloudflare/agent-skills-discovery-rfc) | Static, no added fixed cost. |
| MCP Server Card | Implemented but awaiting deployment | Experimental SEP-2127 card at `/mcp/server-card`, discoverable via ARD and `/.well-known/ai-catalog.json`. The pinned schema and official SDK matched the card's server identity, transport and protocol version. ARD tool names match runtime discovery. The current card schema describes connectivity; tool and resource discovery use MCP. Older scans that probe SEP-1649 filenames may still report a gap. [MCP Server Card draft](https://github.com/modelcontextprotocol/ext-server-card) | Static card. Existing stateless MCP Worker with 13 tools and 10 resources. |
| Web Bot Auth | Not applicable | The portfolio exposes inbound services and operates no outbound bot that needs signed HTTP requests. [RFC 9421](https://www.rfc-editor.org/rfc/rfc9421) · [Web Bot Auth protocol draft 01](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/01/) | No keys or signing infrastructure. |
| WebMCP | Implemented but awaiting deployment | Five imperative tools and two annotated commerce forms. The local estimator and filter reuse shared business logic. Ana requires a trusted click on the form's submit button. Chromium feature detection gates metadata requests and registration. [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp) · [W3C Community Group draft](https://webmachinelearning.github.io/webmcp/) | Browser-side execution. Read tools fetch existing static JSON, and confirmed Ana submissions use the existing Secretary service and its usage limits. Chrome exposure depends on available WebMCP support or an origin trial. |
| DNS-AID | Implemented and verified for the organization index; optional records require manual configuration | Cloudflare's public scan recorded `_index._agents` with an authenticated SVCB answer, TTL 300, apex target, h2 and port 443. `npm run dns:aid` generates two supplemental known-agent TXT proposals from actual MCP and A2A URLs. The proposal checks owner, endpoint, record fields and length. [DNS-AID draft 00, November 2026](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dawn-dnsaid-00) | Existing DNS index remains usable. Additional records require approval and Cloudflare DNS publication. |

## Optional commerce

Each commerce check is **not applicable**. The commercial site has service descriptions, a planning estimator, and human-reviewed inquiries. Public reads have no checkout, payment, or account dependency. These protocols add no output, runtime, deployment step, or cost to this release.

| Protocol evaluated | Condition for future applicability |
| --- | --- |
| ACP, April 17, 2026 revision | A real service purchase flow with order creation, checkout, and fulfilment. [ACP](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) |
| AP2, v0.1 family | A real payment flow that needs an agent mandate and verifiable user authorization. [AP2](https://github.com/google-agentic-commerce/AP2) |
| MPP, HTTP Payment Authentication draft | A priced machine-to-machine service with an actual 402 payment challenge. [MPP](https://mpp.dev/protocol) |
| UCP, August 25, 2026 revision | A merchant-operated transaction flow with business capabilities, order lifecycle, and supported payment handlers. [UCP](https://ucp.dev/2026-08-25/specification/overview/) |
| x402, v2 | A genuinely paid API with a real payment challenge and settlement mechanism. [x402](https://github.com/x402-foundation/x402) |

## Additional audit results

The candidate ARD manifest contains the MCP server, A2A assistant and ten public JSON resources. The official ARD 0.9.1 CLI reported **pass**, zero errors and zero warnings. Its Python JSON Schema module was unavailable, and the local build independently ran the pinned upstream Draft 2020-12 schema through Ajv. The report describes publisher discovery only. No registry, signed trust claim, or search server is needed. [ARD specification](https://agenticresourcediscovery.org/spec/)

| Experimental Lighthouse check | Starting local build | Candidate local build |
| --- | --- | --- |
| WebMCP form coverage | Informative output with zero annotated forms | Pass, both commerce forms covered |
| WebMCP tools registered | Zero tools detected | Five imperative and two declarative tools detected |
| WebMCP schemas valid | Not applicable | Pass |
| ARD manifest valid | Pass with one existing entry | Pass with 12 entries |

The Chromium 156 browser suite passed 26 page and viewport combinations at 1440, 390, and 320 pixels. It recorded zero application console errors, failed requests, CSP violations, and DevTools Issues in the local browsing flow. The test with Ana simulated a provider reply and failure. A native WebMCP run executed budget estimation, project filtering, service lookup, and contact retrieval, exercised the native declarative budget preview, and checked Ana's user confirmation gate. The review also removed a case-study image loading flag that triggered a DevTools issue.

The table compares Lighthouse 13.6.0 lab measurements on the starting and candidate homepage builds. Both used the same loopback file server and blocked the external tracker for repeatability. CDN injections, production compression, and field Core Web Vitals are outside this measurement.

| Metric | Mobile starting | Mobile candidate | Desktop starting | Desktop candidate |
| --- | ---: | ---: | ---: | ---: |
| Performance | 100 | 99 | 100 | 100 |
| Accessibility | 100 | 100 | 100 | 100 |
| Best practices | 100 | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 | 100 |
| Largest Contentful Paint | 1.53 s | 1.53 s | 0.43 s | 0.43 s |
| Total Blocking Time | 69 ms | 125 ms | 0 ms | 0 ms |
| Cumulative Layout Shift | 0 | 0 | 0 | 0 |
| Transfer weight | 73,429 B | 78,141 B | 73,429 B | 78,141 B |

CI now runs Astro checks, artifact validation, a clean rebuild comparison, Wrangler packaging, HTTP and SDK tests, and Chromium checks. The CI-equivalent checks passed locally, including ten HTTP and SDK tests and 120 byte-identical build files. The rate-limit test received HTTP 429 with `Retry-After: 60` after 30 requests from one synthetic local IP. Hosted CI runs when this change reaches GitHub. The external maintenance check reached the official specification sources. Third-party link exceptions included a DOI pending registration, a conference site timeout, and three platforms that restricted automated access.

## Decisions and release boundary

- Keep discovery and content static. The Worker handles representation selection, MCP, and the bounded A2A binding. A2A shares the public catalogue with Ana's public subject matter and performs deterministic retrieval. This avoids agent-triggered model costs.
- Use the current experimental MCP Server Card shape and a namespaced MCP server name. The endpoint, tool IDs and resource URIs stay stable. Clients that match the former server name need the new namespaced value.
- Publish ARD through the standardized manifest path and the documented HTML and HTTP link. The optional robots Agentmap form caused Lighthouse's SEO crawler check to reject the directive.
- Use Cloudflare's documented HTML `no-transform` opt-out to address the existing hash-CSP conflict while retaining the zone's Bot Fight Mode setting. Confirm its effect on edge compression and RUM after the release.
- This workspace has the candidate release and verified local evidence. The live browser baseline still contains the two Cloudflare CSP issues. Release through the existing Workers Builds pipeline, verify the commit marker, rerun the Chromium and HTTP checks, and collect a fresh public Cloudflare score. Additional DNS publication requires approval.
