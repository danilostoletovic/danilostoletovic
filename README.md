# Danilo Stoletović

Source for [danilostoletovic.com](https://danilostoletovic.com/), a static Astro site and public professional catalogue. Cloudflare serves the generated files and handles Streamable HTTP on `/mcp`. Ana uses the existing Secretary Worker.

## Local development

Use Node.js 24 and npm.

```sh
npm ci
npm run build
npm run check
npm run check:worker
npm run preview:worker
```

Open `http://127.0.0.1:8787/` with the Worker preview running. In a second terminal, run `npm test` for the MCP and HTTP checks and `npm run verify:browser` for Playwright and axe. Install Playwright Chromium with `npx playwright install chromium` if needed. `npm run dev` runs Astro alone for page editing.

## Content and outputs

Edit [src/data/public.ts](src/data/public.ts) to update the public record. Use stable lowercase IDs, add primary evidence under `sources`, and use the corresponding project ID to relate an award, case study, publication, or article. Set `includeInCv` on a project or `relevantToClients` on a case study when appropriate. Use publication status and a DOI only when the source supports them. Build-time validation rejects missing evidence, malformed data, and unknown project references.

| Area | Routes |
| --- | --- |
| Identity and directory | `/`, `/links/`, `/cv/` |
| Work | `/commerce/` and service details, `/side-projects/` and project details, `/case/` and case details |
| Research and press | `/academia/`, `/news/`, `/rss.xml` |
| Data and AI | `/profile.md`, `/llms.txt`, `/llms-full.txt`, `/mcp-data.json`, `/mcp-info/`, `/mcp` |

The build also generates `/profile.json`, `/experience.json`, `/projects.json`, `/publications.json`, `/services.json`, `/case-studies.json`, `/news.json`, `/links.json`, `/achievements.json`, and `/contact.json`. The HTML CV and `/cv.pdf` share one presentation model. JSON-LD, RSS, robots.txt, sitemap, and the manifest are generated in the same build. Brand images are derived from the original PNG in `assets/brand/`. Font files used for PDF generation carry their original license in `assets/fonts/`.

Each published paper has a detail page and generated BibTeX and RIS downloads under `/academia/<id>/`. Keep `doiRegistration: 'pending'` while an assigned DOI is unresolved. The build validates metadata locally. The optional link check reports unresolved pending DOIs separately.

Run `npm run check:links` after building to check external catalogue URLs. It distinguishes missing pages from access restrictions, rate limits, and temporary network failures. Review results before changing the catalogue.

## Deployment and maintenance

- [Cloudflare, Ana, MCP, and IndexNow runbook](docs/deployment.md)
- [Public source verification](docs/public-sources.md)
- [External profile update checklist](docs/profile-updates.md)
- [Local verification and Lighthouse comparison](docs/verification.md)

Website code is available under the [MIT License](LICENSE). The supplied monogram, portrait, and project imagery retain their original ownership.
