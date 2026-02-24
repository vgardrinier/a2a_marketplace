# Architecture Enforcement Rules

Quick reference for automated architecture checks. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system design.

## Folder Structure Rules

### ✅ Correct Structure
```
app/
├── api/              # API routes (thin handlers only)
├── (dashboard)/      # UI pages

features/
├── skills/           # Skill feature (isolated)
├── workers/          # Worker feature (isolated)
├── jobs/             # Jobs feature (isolated)
└── payments/         # Payments feature (isolated)

lib/
├── db/               # Database client + schema
├── components/       # Truly shared UI components
└── middleware/       # Shared middleware
```

### ❌ Violations to Block

**Wrong folder placement:**
- Business logic in `app/api/` routes (should be in `features/`)
- Components in `app/components/` (should be in `features/` or `lib/components/`)
- Utilities scattered across features (should be in `lib/`)

**Import violations:**
- `lib/` importing from `features/` → ❌ NEVER
- `features/auth/` importing from `features/billing/` → ❌ NEVER
- `app/api/` importing from `features/` → ✅ OK
- `features/` importing from `lib/` → ✅ OK

## Dependency Rules

### Allowed Import Flow
```
app/ → features/ → lib/
  ↓       ↓
  └───────┘
```

### Circular Dependencies
**BLOCK IMMEDIATELY** if detected:
```
❌ features/jobs/service.ts → features/workers/service.ts → features/jobs/service.ts
❌ lib/utils/helper.ts → features/auth/service.ts → lib/utils/helper.ts
```

## Code Organization Rules

### API Routes (app/api/)
**Rule:** Keep route handlers thin (< 50 lines)

✅ **Good:**
```typescript
// app/api/jobs/route.ts
export async function POST(req: Request) {
  const data = await req.json();
  const result = await JobService.create(data); // Logic in features/
  return Response.json(result);
}
```

❌ **Bad:**
```typescript
// app/api/jobs/route.ts
export async function POST(req: Request) {
  // 100+ lines of business logic here
  const validated = validateJobData(...);
  const worker = await findBestWorker(...);
  const escrow = await lockFunds(...);
  // ... more logic
}
```

### Feature Services (features/)
**Rule:** Each feature is self-contained

✅ **Good:**
```typescript
// features/jobs/service.ts
import { db } from '@/lib/db';           // ✅ lib import ok
import { WorkerService } from '@/features/workers/service'; // ❌ cross-feature import
```

**Fix:** Use dependency injection or events instead of direct imports.

### Shared Code (lib/)
**Rule:** Never import from features or app

✅ **Good:**
```typescript
// lib/db/client.ts
import { Pool } from 'pg';  // ✅ External package
```

❌ **Bad:**
```typescript
// lib/utils/helper.ts
import { JobService } from '@/features/jobs/service'; // ❌ FORBIDDEN
```

## Complexity Rules

### Premature Abstraction
**Flag if:**
- New utility function created
- Used in < 2 places
- Could be inlined

**Why:** YAGNI - wait until 3rd usage before abstracting

### File Size
**Review if:**
- File > 300 lines
- Function > 50 lines
- Suggests need to split

## Test Colocation
**Rule:** Tests live next to implementation

✅ **Good:**
```
features/jobs/
├── service.ts
└── service.test.ts
```

❌ **Bad:**
```
features/jobs/service.ts
tests/jobs/service.test.ts  # ❌ Wrong location
```

## Security Rules

### Environment Variables
**Block commits containing:**
- Hardcoded API keys
- Database credentials
- `.env` file with secrets

**Allowed:**
- `.env.example` (template only)
- References like `process.env.API_KEY`

### SQL Injection Prevention
**Require:** Use Drizzle ORM, never raw SQL with string interpolation

❌ **Bad:**
```typescript
db.execute(`SELECT * FROM users WHERE id = ${userId}`); // ❌ SQL injection risk
```

✅ **Good:**
```typescript
db.select().from(users).where(eq(users.id, userId)); // ✅ Safe
```

## Naming Conventions

### Files
- Components: `PascalCase.tsx`
- Services: `camelCase.ts`
- Types: `types.ts` or `schema.ts`

### Branches
- Features: `feature/description`
- Fixes: `fix/description`
- **Automated:** `cron/description` (not `bot/`)

## Auto-Fix Safety Guidelines

**Safe to auto-fix:**
- Unused imports
- Console.log removal
- Missing TypeScript types (simple cases)
- Formatting

**NEVER auto-fix:**
- Architectural violations (needs human decision)
- Security issues (needs review)
- Cross-feature refactoring
- Database migrations

---

## Enforcement Priorities

**P0 (Block immediately):**
- Circular dependencies
- Security violations
- Import from lib to features

**P1 (Review required):**
- Architecture violations
- Complexity issues
- Missing tests for critical paths

**P2 (Nice to have):**
- Code style inconsistencies
- Documentation gaps
- Minor optimizations
