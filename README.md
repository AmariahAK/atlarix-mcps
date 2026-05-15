# atlarix-mcps

Public MCP registry for the [Atlarix](https://github.com/AmariahAK/Atlarix) MCP marketplace. This repo does **not** ship server code; it publishes a single JSON index Atlarix fetches over HTTPS.

## Consumed URL (Atlarix default)

Atlarix loads this raw file (schema: `McpRegistryIndex` — `version` + `mcps` array, each entry uses **`installUrl`**, not `installCommand`):

https://raw.githubusercontent.com/AmariahAK/atlarix-mcps/main/index.json

You can mirror that file or point the app at a custom URL in settings.

## Layout

| Path | Purpose |
|------|---------|
| `index.json` | **Generated** merged registry (do not edit by hand) |
| `registry.overrides.json` | Curated deep-merges and extra entries — **edit via PR** |
| `scripts/sync.mjs` | Node 20+ sync: GitHub API + awesome README + overrides |

Optional keys on entries (`verified`, `needsReview`) are ignored by Atlarix today but are kept for tooling and review; see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Upstream data

- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) and [modelcontextprotocol/servers-archived](https://github.com/modelcontextprotocol/servers-archived) — npm packages under `src/<dir>/package.json` (same `id` as directory name; main repo wins when both define a folder)
- [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) — README bullets with a GitHub link and a `` `npx …` `` hint
- [microsoft/mcp](https://github.com/microsoft/mcp) — skipped in automation (NuGet / non-`npx` templates)

## Automation

GitHub Actions (`.github/workflows/sync.yml`) runs on a weekly schedule (Monday 00:00 UTC), `workflow_dispatch`, and pushes to `main`. It regenerates `index.json` and commits only when the file changes (`chore: sync MCP registry [skip ci]`).

## Local dry-run

Per-source counts are printed to stdout (official main/archived dir counts, awesome line/hit counts, merged size, `needsReview` tally):

```bash
npm run sync:dry-run
# or: node scripts/sync.mjs --dry-run
```

Use `--print-json` with `--dry-run` to dump the merged payload without writing `index.json`. Set `GITHUB_TOKEN` for a higher GitHub API quota.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the **Request a server** issue template.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
