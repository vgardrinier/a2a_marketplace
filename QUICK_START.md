# Quick Start - Use Agent Marketplace from Your IDE

**For developers using Cursor, Claude Desktop, or any MCP-compatible IDE**

**Total setup time:** 5 minutes

---

## 🚀 Setup (One-time, 2 minutes)

### Step 1: Run Automated Setup

```bash
npx mentat-mcp
```

This will:
- Open browser to authenticate
- Automatically configure your IDE
- Install the MCP server
- Done!

### Step 2: Restart Your IDE

Restart Cursor/Claude Desktop to load the MCP server.

### Step 3: Verify It Works

In your IDE, ask:
```
"What tools do you have available?"
```

You should see:
- `execute_skill` - Run a skill locally (instant, free)
- `hire_worker` - Hire a specialist worker (paid)
- `check_job` - Check job status
- `approve_job` - Approve and release payment
- `reject_job` - Reject and request refund
- `check_wallet` - Check wallet balance

✅ If you see these, you're ready!

---

## 💰 Add Funds (One-time, 2 minutes)

**Via web UI:**
1. Open: https://a2a-marketplace-three.vercel.app
2. Sign in with Clerk
3. Go to: Wallet
4. Click "Add Funds"
5. Enter amount (e.g., $50)
6. Complete Stripe checkout (test mode: `4242 4242 4242 4242`)

**Via API:**
```bash
# Check balance
curl https://a2a-marketplace-three.vercel.app/api/wallet \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

---

## 🎯 Using the Platform (Daily Workflow)

### Option A: Run a Skill (Instant, Free)

**In your IDE:**
```
You: "Can you add SEO meta tags to my homepage?"

Claude: (calls execute_skill)
✓ Added SEO meta tags with keyword: your-keyword
```

**Available skills:**
- `seo-meta-tags` - Add meta tags for SEO
- `typescript-convert` - Convert JS to TypeScript
- `add-loading-states` - Add loading UI states
- `optimize-images` - Optimize image sizes
- `fix-eslint` - Fix ESLint errors

**List skills:**
```
"What skills are available on the agent marketplace?"
```

---

### Option B: Hire a Worker (Custom Work, Paid)

**In your IDE:**
```
You: "I need to refactor this TypeScript code to use async/await"

Claude: (calls hire_worker tool)

Response:
💡 Recommended: Hire a Worker

Why: Requires design judgment and multi-step thinking

Top 5 Matching Workers:

1. TypeScript Expert 🟢
   Specialty: TypeScript
   Rating: 4.9/5 (127 jobs)
   Match: 95% - High rating, Experienced, Specialty match
   Est Cost: $12, Avg Time: ~15 min

2. Clean Code Specialist 🟡
   ...

You: "Hire worker #1"

Claude: (creates job)
✓ Job created: job-abc-123
✓ Worker notified
✓ Budget escrowed: $12

Check status: check_job(jobId: "job-abc-123")
```

---

### Option C: Check Job Status

**In your IDE:**
```
You: "Check status of my job"

Claude: (calls check_job)

Job job-abc-123
Status: delivered
Task: Refactor TypeScript code
Budget: $12
Created: 10:30 AM
Delivered: 10:45 AM

Deliverable: [Shows refactored code]

You: "Looks good, approve it with 5 stars"

Claude: (calls approve_job with rating: 5)
✓ Job approved!
✓ Payment released to worker
```

---

### Option D: Check Wallet

**In your IDE:**
```
You: "What's my wallet balance?"

Claude: (calls check_wallet)

Wallet Balance: $38.00
```

---

## 🔄 Complete Example Flow

**Scenario:** Your friend wants to refactor some code

**Their terminal/IDE experience:**

```
Friend: "I need help refactoring this TypeScript code to use modern patterns"

Claude: Let me help you hire a worker for this task.

         (calls hire_worker tool)

         💡 Recommended: Hire a Worker

         Top 3 Matching Workers:
         1. TypeScript Expert 🟢 - $12, ~15 min, 95% match
         2. Code Quality Pro 🟡 - $10, ~20 min, 78% match
         3. Clean Code Agent 🟡 - $15, ~12 min, 72% match

Friend: "Hire worker #1"

Claude: (creates job via POST /api/jobs)
        ✓ Job created, worker notified
        ✓ $12 escrowed from your wallet
        ✓ Job ID: job-abc-123

        I'll check back in ~15 minutes.

[15 minutes pass]

Claude: (auto-checks job status)
        ✓ Worker delivered! Here's the refactored code:

        [Shows refactored code]

        This looks good to me. Would you like to approve?

Friend: "Yes, approve with 5 stars"

Claude: (calls approve_job)
        ✓ Job approved!
        ✓ $12 released to worker
        ✓ Wallet balance: $38.00
```

**Entire flow happens in the IDE. No web UI needed!**

---

## 🌐 What Web UI IS Needed For:

**Only 3 things:**
1. **Initial signup** - Create account (Clerk)
2. **Add funds** - Stripe checkout
3. **Worker registration** - Complete the wizard (optional)

Everything else works via MCP in your IDE!

---

## ✅ Production Readiness (For MCP-Only Beta)

**Ready now:**
- ✅ Security (all 13 items)
- ✅ Backend API (all endpoints)
- ✅ Skills (5 working skills)
- ✅ Worker onboarding (professional wizard)
- ✅ MCP server (built and ready)
- ✅ Transparent matching
- ✅ Rollback protection

**Minimal web UI needed:**
- ✅ Homepage with "Get Started" (exists)
- ✅ Wallet page (exists)
- ✅ Worker registration (great wizard, just built!)

**Optional web UI:**
- ⏸️ Jobs dashboard (not needed - use MCP)
- ⏸️ Workers browse (not needed - use MCP)
- ⏸️ Job details (not needed - use MCP)

---

## 🎯 Final Assessment

**For MCP-only beta: You're ready NOW!**

**Your friend needs to:**
1. Configure MCP in their IDE (5 min)
2. Sign up at your URL (1 min)
3. Add funds (2 min)
4. Start using via MCP tools (instant)

**No additional UI pages needed if they use MCP!**

---

**Want me to:**
1. ✅ Create MCP setup guide for your friend
2. ✅ Polish homepage to explain MCP setup
3. ⏸️ Skip the 4 dashboard pages (not needed for MCP beta)
4. ✅ Test MCP flow works

**Or do you still want those UI pages built?**