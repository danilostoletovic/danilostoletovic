# Agent readiness implementation checklist

- [x] Inspect the existing Astro artifacts, Worker routes, production CSP and crawler policy.
- [x] Confirm the Umami Cloud collector and centralize the CSP policy.
- [x] Establish a repeatable Lighthouse and HTTP baseline and verify actual live analytics delivery.
- [x] Verify protocol versions and applicability against primary specifications.
- [x] Generate discovery, Markdown, transport metadata, headers, and skills from shared definitions.
- [x] Register WebMCP tools and validate their interaction boundaries in Chromium.
- [x] Add CI checks for generated files, Worker responses, MCP, browser behavior, and build determinism. Verify the same commands locally.
- [x] Record the artifact inventory, before-and-after results, protocol limits, and release instructions.
- [ ] Run hosted CI and production verification after release, including the public scanner and Cloudflare edge injections.
