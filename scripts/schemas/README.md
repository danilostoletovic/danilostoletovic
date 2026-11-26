# Offline validation schemas

These upstream snapshots are development files. The Astro build serves public documents in `dist/` and keeps these schemas in the repository.

| File | Upstream revision |
| --- | --- |
| `ard-entry.schema.json` | [ARD entry and manifest schema, revision `03063a3`](https://github.com/ards-project/ard-spec/blob/03063a3c15a16ddf26e9772211b73fec1883590a/spec/schemas/ard-entry.schema.json) |
| `mcp-server-card.schema.json` | [Experimental MCP Server Card draft, revision `28db12c`](https://github.com/modelcontextprotocol/ext-server-card/blob/28db12c9b4a379489d46e49bf1bd4a991f05c9b7/schema.json) |
| `openapi.schema.json` | [OpenAPI 3.1 document schema, 2025-09-15](https://spec.openapis.org/oas/3.1/schema/2025-09-15) |

The upstream ARD project, Model Context Protocol project, and OpenAPI Initiative publish these snapshots under the [Apache License 2.0](LICENSE-APACHE-2.0).

`validate-artifacts.mjs` also checks RFC 9264 Linkset structure, the Cloudflare Agent Skills Discovery draft 0.2.0 rules, and the A2A 1.0.1 Agent Card model. The OpenAPI check resolves the default dialect's dynamic schema anchor in memory for Ajv and independently checks each API response schema and deployed JSON snapshot.
