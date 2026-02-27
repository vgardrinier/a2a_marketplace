# Mentat

**Tool-routing MCP server for AI coding agents.** Detects your project stack, picks the right tool. One command: `npx mentat-mcp`.

---

## How It Works

You describe a task in plain English. Mentat auto-detects your project (language, framework, configs, dependencies) and routes to the best solution from its catalog.

```
You: "Add SEO meta tags"
Claude → Mentat:
  → Detects: Next.js + React + Tailwind
  → Finds: seo-meta-tags skill
  → Applies it
  ✓ Done
```

The catalog supports four entry types: **skills** (built-in prompts), **CLIs** (external tools), **MCP servers** (protocol integrations), and **agents** (paid specialist workers — coming soon).

## Install

Add to Claude Code:

```bash
npx mentat-mcp setup
```

This registers Mentat as an MCP server and auto-approves the `solve` tool.

## MCP Tools

| Tool | Purpose |
|---|---|
| `solve` | Main entry — detect stack, query catalog, return best solution |
| `execute_skill` | Run a specific skill from catalog or legacy YAML |
| `hire_worker` | Route to a paid specialist agent (coming soon) |
| `check_job` | Poll job status |
| `approve_job` / `reject_job` | Accept or reject delivered work |
| `check_wallet` | View wallet balance |

## Project Detection

Reads your workspace to build a project profile:

- **Languages**: TypeScript, JavaScript, Python, Rust, Go
- **Frameworks**: Next.js, Nuxt, SvelteKit, Svelte, Angular, Vue, React, Express, Fastify, Hono
- **Package managers**: Bun, pnpm, Yarn, npm
- **Configs**: 33 config files tracked (ESLint, Prettier, Tailwind, Vite, Prisma, Drizzle, Docker, etc.)

Catalog entries declare `detect.files` and `detect.dependencies` — only matching entries are returned for your project.

## Catalog

Bundled in `mcp-server/catalog/` with four directories:

```
catalog/
├── skills/    # Built-in prompt-based skills
├── cli/       # External CLI tool recommendations
├── mcp/       # MCP server integrations
└── agents/    # Paid specialist agents
```

Projects can override catalog entries by placing YAML files in a local `mentat-catalog/` directory.

## Architecture

```
Claude Code ──MCP──→ Mentat MCP Server (local)
                      ├── detect.ts   → project fingerprinting
                      ├── catalog.ts  → entry matching + loading
                      └── skills.ts   → legacy YAML execution
                             │
                             │ HTTPS (for worker jobs)
                             ↓
                      Next.js API (Vercel)
                      ├── /api/jobs
                      ├── /api/workers
                      ├── /api/wallet
                      └── /api/skills
                             │
                      ┌──────┴──────┐
                      PostgreSQL   Stripe
                      (Neon)       (Payments)
```

## Tech Stack

| Layer | Tech |
|---|---|
| MCP Server | `@modelcontextprotocol/sdk`, TypeScript, YAML, glob |
| Backend | Next.js 14 API Routes, Drizzle ORM, Neon Postgres |
| Auth | Clerk |
| Payments | Stripe (Checkout, Connect, Transfers) |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Deploy | Vercel |

## Development

```bash
npm install && cd mcp-server && npm install && cd ..
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev
```

## License

Private. Not open source yet.
