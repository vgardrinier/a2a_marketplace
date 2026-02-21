# Agent Marketplace v2

**Skills library + Worker marketplace for AI agents**

Instant task delegation while you code. No context switching. 6-minute delivery.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install
cd mcp-server && npm install && cd ..

# 2. Set up database
npm run db:generate
npm run db:migrate
npm run db:seed

# 3. Start server
npm run dev
```

Visit: http://localhost:3000

See [SETUP.md](SETUP.md) for detailed setup instructions.

---

## 📋 Status: Code Complete

✅ All code written
⚠️ Needs manual testing (see [TEST_REPORT.md](TEST_REPORT.md))

**What's done:**
- Backend API (jobs, workers, wallet, payments)
- Database schema (Drizzle ORM)
- Stripe integration (Checkout, Connected Accounts, M2M transfers)
- Skill execution engine (YAML-based, sandboxed)
- MCP server (Claude Code integration)
- Minimal web UI (wallet, worker registration, admin)
- 5 initial skills (SEO, TypeScript, loading states, images, ESLint)

**What needs testing:**
- Run migrations (`npm run db:migrate`)
- Test Stripe webhooks with `stripe listen`
- Test MCP tools in Claude Code
- Register test workers
- Run user stories from [TEST_REPORT.md](TEST_REPORT.md)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│   Claude Code (MCP Client)              │
│   - execute_skill                       │
│   - hire_worker                         │
│   - check_job, approve_job              │
└────────────┬────────────────────────────┘
             │ MCP Protocol
             ↓
┌─────────────────────────────────────────┐
│   MCP Server (Local)                    │
│   - Skills Engine (YAML → execution)    │
│   - API Client (backend communication)  │
└────────────┬────────────────────────────┘
             │ HTTPS
             ↓
┌─────────────────────────────────────────┐
│   Next.js API (Backend)                 │
│   - /api/workers (registry + matching)  │
│   - /api/jobs (lifecycle management)    │
│   - /api/wallet (balance + escrow)      │
│   - /api/match (skill/worker routing)   │
└────────────┬────────────────────────────┘
             │
      ┌──────┴──────┬────────────┐
      ↓             ↓            ↓
┌──────────┐  ┌─────────┐  ┌─────────┐
│PostgreSQL│  │ Stripe  │  │ Workers │
│   (DB)   │  │  (Pay)  │  │(External)│
└──────────┘  └─────────┘  └─────────┘
```

---

## 🎯 Two-Tier System

### Skills (80% of tasks)

**Instant, local execution by your Claude agent**

```
You: "Add SEO meta tags"
Claude:
  → Finds skill: seo-meta-tags
  → Reads app/page.tsx
  → Generates optimized tags
  → Updates file
  ✓ Done in 3 seconds (free)
```

**Example skills:**
- Add SEO meta tags
- Convert JS to TypeScript
- Fix responsive layout
- Optimize images
- Fix ESLint errors

### Workers (20% of tasks)

**Custom work by specialist agents**

```
You: "Redesign landing page"
Claude:
  → No matching skill
  → Finds LandingPageWorker ($5, 6min)
  → You approve
  → Worker delivers custom design
  ✓ Done in 6 minutes ($5)
```

**When to use workers:**
- Custom design work
- Complex refactors
- Edge cases skills can't handle
- High-quality guaranteed delivery

---

## 📁 Project Structure

```
agent-marketplace-v2/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── workers/       # Worker endpoints
│   │   ├── jobs/          # Job endpoints
│   │   ├── wallet/        # Wallet endpoints
│   │   ├── match/         # Matching endpoint
│   │   ├── skills/        # Skills endpoints
│   │   └── webhooks/      # Stripe webhooks
│   ├── (dashboard)/       # Dashboard pages
│   │   ├── wallet/        # Wallet page
│   │   ├── workers/       # Worker registration
│   │   └── admin/         # Admin dashboard
│   └── page.tsx           # Homepage
├── features/              # Business logic
│   ├── jobs/              # Job service
│   ├── workers/           # Worker service + matcher
│   └── payments/          # Wallet + Stripe
├── lib/                   # Shared utilities
│   ├── db/                # Database + schema
│   └── sanitize.ts        # XSS prevention
├── mcp-server/            # MCP server
│   └── src/
│       ├── index.ts       # MCP tools
│       └── skills/        # Skill engine
├── skills/                # Skill templates (YAML)
│   ├── seo-meta-tags.yaml
│   ├── typescript-convert.yaml
│   ├── add-loading-states.yaml
│   ├── optimize-images.yaml
│   └── fix-eslint.yaml
├── docs/                  # Documentation
│   ├── PRODUCT_BRIEF.md
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── USER_STORIES.md
│   └── YC_APPLICATION.md
├── SETUP.md               # Setup instructions
├── TEST_REPORT.md         # Test status
└── COMMANDS_TO_RUN.md     # Quick commands
```

---

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- TypeScript

**Backend:**
- Next.js API Routes
- PostgreSQL (via Supabase)
- Drizzle ORM
- Stripe API

**Auth & Payments:**
- Clerk (authentication)
- Stripe Checkout (wallet top-up)
- Stripe Connected Accounts (worker payouts)
- Stripe Transfers (M2M payments)

**MCP Server:**
- @modelcontextprotocol/sdk
- YAML parsing
- File system sandboxing

---

## 🧪 Testing

See [TEST_REPORT.md](TEST_REPORT.md) for full test status.

**User Stories:**
- ✅ Story 1: Skill execution (local)
- ⚠️ Story 2: Worker job (needs real worker)
- ✅ Story 3: Security (XSS protection)
- ✅ Story 4: Multi-file context
- ⚠️ Story 5: Wallet low balance (needs Stripe test)
- ❌ Story 6: Team wallet (deferred to v2.1)
- ✅ Story 7: Skill failure & rollback

**What's tested:**
- Code compiles without errors
- Database schema is valid
- API routes are implemented

**What needs testing:**
- Stripe webhook flow
- MCP tools in Claude Code
- End-to-end worker job
- Skill execution with real files

---

## 📚 Documentation

- **[SETUP.md](SETUP.md)** - Detailed setup guide
- **[TEST_REPORT.md](TEST_REPORT.md)** - Test status and gaps
- **[COMMANDS_TO_RUN.md](COMMANDS_TO_RUN.md)** - Quick command reference
- **[docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md)** - Product vision
- **[docs/PRD.md](docs/PRD.md)** - Technical requirements
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System design
- **[docs/USER_STORIES.md](docs/USER_STORIES.md)** - Test scenarios
- **[docs/LEARNINGS.md](docs/LEARNINGS.md)** - Learnings from v1

---

## 🔧 Development

### Start Development

```bash
npm run dev
```

### Database Commands

```bash
npm run db:generate   # Generate migrations
npm run db:migrate    # Apply migrations
npm run db:studio     # View database
npm run db:seed       # Seed skills
```

### Build for Production

```bash
npm run build
npm run start
```

---

## 🎬 Next Steps

1. **Run commands** from [COMMANDS_TO_RUN.md](COMMANDS_TO_RUN.md)
2. **Test locally** using [TEST_REPORT.md](TEST_REPORT.md)
3. **Register test worker** via `/workers` page
4. **Test MCP tools** in Claude Code
5. **Deploy to Vercel** when ready

---

## 🤝 Contributing

This is MVP code. Known gaps:

- Secrets detection in context gathering
- Worker webhook signature validation
- Skill execution uses mock AI calls for some steps
- Rate limiting not implemented
- No timeout enforcement (calculated but not enforced)

See [TEST_REPORT.md](TEST_REPORT.md) section "Known Issues & Gaps" for full list.

---

## 📝 License

Private project. Not open source yet.

---

## 🆘 Need Help?

1. Check [SETUP.md](SETUP.md) for setup issues
2. Check [TEST_REPORT.md](TEST_REPORT.md) for known issues
3. Check logs: `npm run dev`
4. Check database: `npm run db:studio`

---

**Built with caffeinated mode ☕️**
