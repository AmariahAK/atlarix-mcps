# atlarix-mcps

The official MCP server registry for [Atlarix](https://github.com/AmariahAK/atlarix).

This repo is a curated index of free, open-source MCP servers that work out of the box with Atlarix's MCP marketplace. We don't build or maintain the servers — we just point to them.

## Sources

- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — official reference implementations by Anthropic (MIT)
- [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) — community-maintained list

## Registry

The registry is a single file: [`registry.json`](./registry.json)

Atlarix fetches this on the MCP marketplace tab and renders the list automatically. Users connect servers directly — no manual config files needed.

## Current servers

| Server | Description |
|--------|-------------|
| GitHub | Search repos, manage issues and PRs |
| Filesystem | Read and write local files |
| PostgreSQL | Query PostgreSQL databases |
| Slack | Read channels, post messages |
| Brave Search | Web search via Brave API |
| SQLite | Query local SQLite databases |
| Memory | Persistent cross-session knowledge graph |
| Puppeteer | Browser automation and scraping |
| Sentry | Read errors and issues |
| Linear | Manage Linear issues |
| Notion | Read and write Notion pages |
| Jira | Read and create Jira issues |
| AWS Knowledge Base | Retrieve from Bedrock Knowledge Bases |
| Redis | Read and write Redis data |
| Docker | Manage containers and images |
| Vercel | Manage deployments and projects |
| Supabase | Query Supabase tables |
| Stripe | Read payments and subscriptions |
| AWS CloudWatch | Read logs and metrics |
| Google Maps | Places search and directions |

## Adding a server

Open a PR that adds an entry to `registry.json` following the existing shape. Required fields: `id`, `name`, `description`, `installCommand`, `authType`, `envVars`, `tags`, `tier`.