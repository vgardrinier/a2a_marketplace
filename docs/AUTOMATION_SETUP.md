# Automation Setup Guide

This guide walks you through setting up the automated code audit and architecture enforcement workflows.

## What Gets Automated

### 1. Nightly Code Audit (2 AM UTC)
- ✅ Only runs if code was pushed in last 24 hours
- ✅ Analyzes ONLY changed files (not entire codebase)
- ✅ Auto-fixes safe issues (unused imports, console.logs, etc.)
- ✅ Creates PR with fixes ready for your review
- ✅ Creates issues for complex problems

### 2. Architecture Guard
- ✅ Runs on every PR (checks only changed files)
- ✅ Weekly deep scan (Sundays at midnight)
- ✅ Enforces rules from `docs/ARCHITECTURE_RULES.md`
- ✅ Blocks PRs with violations
- ✅ Creates weekly health report

## Setup Steps

### Step 1: Fix API Key Location ⚠️

You created the API key in an **Environment** but scheduled workflows need **Repository Secrets**.

**Do this:**

1. Go to: https://github.com/vgardrinier/mentat/settings/secrets/actions

2. Click **"New repository secret"**

3. Name: `ANTHROPIC_API_KEY`

4. Value: Your Anthropic API key from console.anthropic.com

5. Click **"Add secret"**

**Note:** You can delete the environment secret you created earlier - it won't be used.

### Step 2: Push Workflow Files

The workflow files are ready in `.github/workflows/`:
- `nightly-audit.yml`
- `architecture-guard.yml`

Commit and push them:

```bash
git add .github/workflows/ docs/ARCHITECTURE_RULES.md docs/AUTOMATION_SETUP.md
git commit -m "add automated code audit and architecture enforcement"
git push
```

### Step 3: Test the Workflows

**Test Nightly Audit manually:**

1. Go to: https://github.com/vgardrinier/mentat/actions/workflows/nightly-audit.yml

2. Click **"Run workflow"** → **"Run workflow"**

3. Wait ~2-3 minutes

4. Check if:
   - Workflow completes successfully
   - If issues found: PR created with `cron/auto-fix-*` branch
   - If no issues: Job says "No issues found"

**Test Architecture Guard:**

1. Create a test PR (or wait for next PR)

2. Workflow runs automatically

3. Claude comments on PR with architecture review

## How It Works

### Cost Optimization

**Smart skipping:**
- Nightly audit only runs if commits exist in last 24h
- Analyzes ONLY changed files, not entire codebase
- Uses Sonnet (cheaper) not Opus

**Estimated costs:**
- Nightly audit: $0.20-0.80 per run (only if code changed)
- Architecture check: $0.05-0.20 per PR
- Weekly scan: $1-3 per week
- **Total: ~$15-30/month** for active development

**No cost if no activity** - workflow skips itself.

### Branch Naming

All automated branches use `cron/` prefix:
- `cron/auto-fix-2026-02-24`
- `cron/update-docs-2026-02-24`

Easy to identify bot-created branches.

### What Gets Auto-Fixed vs Flagged

**Auto-fixed (PR created):**
- Unused imports/exports
- Console.log statements
- Dead code (unreferenced)
- Missing TypeScript types
- Formatting issues

**Flagged as issue (needs human):**
- Architecture violations
- Circular dependencies
- Security issues
- Performance problems
- Complex refactoring needed

## Workflow Outputs

### Successful Nightly Audit
```
✅ Nightly Code Audit
   └─ check-activity: ✅ (found 5 commits)
   └─ audit: ✅ (created PR #42)
```

You'll see:
- New PR: `🤖 Auto-fix: Remove 8 unused imports`
- Or issue: `🔍 Code Review: Circular dependency in features/`

### Skipped (No Activity)
```
✅ Nightly Code Audit
   └─ check-activity: ✅ (no commits, skipped)
   └─ audit: ⊘ (skipped)
```

No cost incurred.

### Architecture Guard (PR)
```
✅ Architecture Guard
   └─ check-architecture: ✅
```

Claude comments on PR:
- ✅ "Architecture check passed" → merge freely
- ❌ "Violations found: ..." → fix before merge

## Customization

### Change Schedule

Edit `.github/workflows/nightly-audit.yml`:

```yaml
schedule:
  - cron: "0 2 * * *"  # 2 AM UTC
```

[Use crontab.guru](https://crontab.guru) to adjust timing.

### Adjust Auto-Fix Rules

Edit the prompt in `nightly-audit.yml` under `AUTO-FIXABLE` section.

Add or remove types of issues Claude should auto-fix.

### Architecture Rules

Edit `docs/ARCHITECTURE_RULES.md` to add/remove enforcement rules.

Changes take effect on next workflow run.

## Monitoring

### Check Workflow History

1. Go to: https://github.com/vgardrinier/mentat/actions

2. Filter by workflow:
   - "Nightly Code Audit"
   - "Architecture Guard"

3. Click runs to see logs

### Notifications

You'll get GitHub notifications for:
- PRs created by automation
- Issues created
- Workflow failures

Configure in: Settings → Notifications

## Troubleshooting

### Workflow fails with "API key not found"

**Problem:** Secret not set correctly

**Fix:**
1. Check https://github.com/vgardrinier/mentat/settings/secrets/actions
2. Verify `ANTHROPIC_API_KEY` exists (not in Environment)
3. Re-run workflow

### Audit runs on every commit

**Problem:** Expected behavior on manual trigger

**Fix:** Scheduled runs only happen at 2 AM and skip if no commits

### Too many PRs created

**Problem:** Lots of issues found

**Fix:**
1. Merge a few auto-fix PRs
2. Workflow will find fewer issues next time
3. Or adjust auto-fix rules to be less aggressive

### Claude suggests wrong architecture

**Problem:** Rules unclear

**Fix:** Update `docs/ARCHITECTURE_RULES.md` with clearer examples

## Advanced: Agent Teams (Future)

Once stable, you could add:
- Parallel security scan
- Performance profiling
- Dependency update automation

See Claude Code docs for agent teams: https://code.claude.com/docs/en/agent-teams.md

## Support

If workflows fail repeatedly:
1. Check workflow logs for errors
2. Verify API key has credits
3. Review Anthropic API status
4. File issue with logs attached

---

**Next:** Push workflows and test with manual trigger!
