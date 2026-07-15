# Contributing to atlarix-mcps

Thanks for helping improve the MCP registry used by [Atlarix](https://github.com/AmariahAK/Atlarix).

## Generated data

**Do not hand-edit `index.json`.** It is produced by `scripts/sync.mjs` (run locally or via GitHub Actions). Any manual edit will be overwritten on the next sync.

## Curated overrides

To fix metadata, env vars, labels, or to add a community server that is not picked up automatically, edit **`registry.overrides.json`** and open a pull request.

The file is an object `mcps` whose keys are registry **`id`** strings. Values are partial [`McpRegistryEntry`](https://github.com/AmariahAK/Atlarix/blob/main/src/shared/mcp-registry.ts)-shaped objects. They are **deep-merged** onto the automated entries; **override fields win**. To add a brand-new entry, use a new `id` key and supply at least `name`, `description`, `installUrl`, `authType` (`none` or `env`), and `envVars` (array, possibly empty).

### OAuth (remote HTTP) MCPs

For hosted MCP servers that users sign in to (no API key to paste), set `authType: "oauth"` and provide `url` (the remote HTTP/SSE endpoint) **instead of** `installUrl`. Add an `oauth` object to describe the flow — every field is optional because most servers expose OAuth metadata discovery + dynamic client registration:

```json
"linear-remote": {
  "name": "Linear (OAuth)",
  "description": "Linear issues and projects via Linear's hosted MCP — sign in with OAuth",
  "icon": "linear",
  "source": "https://linear.app/docs/mcp",
  "url": "https://mcp.linear.app/sse",
  "authType": "oauth",
  "oauth": {
    "serverUrl": "https://mcp.linear.app",   // optional: authorization server base
    "clientId": "abc123",                      // optional: omit for dynamic registration
    "scopes": ["read", "write"],               // optional: scopes to request
    "discoveryUrl": "https://…/.well-known/oauth-authorization-server", // optional
    "supportsDynamicRegistration": true         // optional, defaults to true
  },
  "envVars": [],
  "tier": "pro"
}
```

OAuth entries are launched from `url` (not `installUrl`) and surface a one-click **Connect** button in the marketplace. Auto-discovered upstream entries are only ever `env`/`none`; `oauth` is hand-curated here.

### Optional JSON fields

- **`verified`**: reserved for official / vetted rows from upstream automation (Atlarix may ignore this today).
- **`needsReview`**: `true` when install commands or env requirements were inferred and should be double-checked (Atlarix may ignore this today).

## Upstream sources

The sync script merges:

- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) and [modelcontextprotocol/servers-archived](https://github.com/modelcontextprotocol/servers-archived) (`src/<dir>/package.json`, `npx -y <npm name>`)
- [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (README lines that include a GitHub link and a `` `npx …` `` install hint)
- [microsoft/mcp](https://github.com/microsoft/mcp) is probed and **skipped** (NuGet-based samples, not `npx` npm installs)

Duplicates are resolved by preferring the official MCP org repos over the awesome list.

## Local sync

```bash
node scripts/sync.mjs --dry-run   # summary only; does not write index.json
node scripts/sync.mjs             # writes index.json
```

Optional: set `GITHUB_TOKEN` (or `GH_TOKEN`) for a higher GitHub API rate limit.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0 (`LICENSE`).
