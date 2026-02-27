import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectProjectContext, clearDetectCache } from './detect.js';
import { CatalogLibrary } from './catalog.js';
import { formatSolveResponse } from './index.js';
import { createFixture, cleanupFixture, packageJson } from './test-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_CATALOG = path.resolve(__dirname, '..', 'catalog');

let fixtureDir: string;

/** Run the full pipeline: detect → catalog load + filter → format */
async function solvePipeline(dir: string, task: string, targetFiles?: string[]) {
  clearDetectCache();
  const profile = await detectProjectContext(dir);
  const catalog = new CatalogLibrary(dir, BUNDLED_CATALOG);
  const entries = await catalog.getRelevantEntries(profile);
  const response = formatSolveResponse(profile, entries, task, targetFiles);
  return { profile, entries, response };
}

function entryIds(entries: { id: string }[]): string[] {
  return entries.map((e) => e.id);
}

// ─── User Story Tests ───────────────────────────────────────────────

describe('solve routing — user stories', () => {
  afterEach(async () => {
    if (fixtureDir) await cleanupFixture(fixtureDir);
  });

  it('Story 1: "deploy this" — Next.js + Vercel user', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        react: '^18.0.0',
        '@sentry/nextjs': '^7.0.0',
      }),
      'tsconfig.json': '{}',
      'vercel.json': '{}',
    });

    const { profile, entries, response } = await solvePipeline(fixtureDir, 'deploy this');

    // Project detection
    expect(profile.language).toContain('TypeScript');
    expect(profile.framework).toBe('Next.js');

    const ids = entryIds(entries);

    // Sentry entries show up (deps match @sentry/nextjs or next)
    expect(ids).toContain('sentry-fix-issues');

    // Universal entries always show
    expect(ids).toContain('frontend-design');

    // Stripe should NOT show — no stripe dep
    expect(ids).not.toContain('stripe-best-practices');

    // Response structure
    expect(response).toContain('## Your Project');
    expect(response).toContain('## Available Solutions');

    console.log(`  Story 1: ${entries.length} entries returned`);
  });

  it('Story 2: "fix production errors" — Sentry user', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        react: '^18.0.0',
        '@sentry/nextjs': '^7.0.0',
        '@modelcontextprotocol/sdk': '^0.5.0',
      }),
    });

    const { entries } = await solvePipeline(fixtureDir, 'fix production errors');
    const ids = entryIds(entries);

    // Both Sentry entries that match @sentry/nextjs should appear
    expect(ids).toContain('sentry-fix-issues');
    expect(ids).toContain('sentry-create-alert');

    // Count sentry entries
    const sentryEntries = ids.filter((id) => id.startsWith('sentry-'));
    expect(sentryEntries.length).toBeGreaterThanOrEqual(2);

    console.log(`  Story 2: ${entries.length} entries, ${sentryEntries.length} sentry-related`);
  });

  it('Story 3: "add payments" — Stripe user', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        react: '^18.0.0',
        stripe: '^14.0.0',
      }),
    });

    const { entries } = await solvePipeline(fixtureDir, 'add payments');
    const ids = entryIds(entries);

    // Stripe's official best practices
    expect(ids).toContain('stripe-best-practices');

    console.log(`  Story 3: ${entries.length} entries returned`);
  });

  it('Story 4: "send email notifications" — Resend user', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        resend: '^3.0.0',
      }),
    });

    const { entries } = await solvePipeline(fixtureDir, 'send email notifications');
    const ids = entryIds(entries);

    // Resend-specific entries
    expect(ids).toContain('send-email');
    expect(ids).toContain('resend-skills');

    console.log(`  Story 4: ${entries.length} entries returned`);
  });

  it('Story 5: "build an MCP server" — developer building integrations', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        '@modelcontextprotocol/sdk': '^0.5.0',
      }),
      'tsconfig.json': '{}',
    });

    const { entries } = await solvePipeline(fixtureDir, 'build an MCP server');
    const ids = entryIds(entries);

    // MCP building guidance
    expect(ids).toContain('mcp-builder');

    console.log(`  Story 5: ${entries.length} entries returned`);
  });

  it('Story 6: "make this look good" — non-dev builder wanting UI help', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        react: '^18.0.0',
        tailwindcss: '^3.0.0',
      }),
      'tsconfig.json': '{}',
    });

    const { entries } = await solvePipeline(fixtureDir, 'make this look good');
    const ids = entryIds(entries);

    // Universal design entries (no detect rules = always available)
    expect(ids).toContain('frontend-design');
    expect(ids).toContain('theme-factory');

    // web-artifacts-builder matches via tailwindcss dep
    expect(ids).toContain('web-artifacts-builder');

    console.log(`  Story 6: ${entries.length} entries returned`);
  });

  it('Story 7: "test my app" — wants to add tests', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        playwright: '^1.40.0',
      }),
      'pyproject.toml': '[project]\nname = "my-app"\n',
    });

    const { entries } = await solvePipeline(fixtureDir, 'test my app');
    const ids = entryIds(entries);

    // webapp-testing matches via playwright dep AND pyproject.toml file
    expect(ids).toContain('webapp-testing');

    console.log(`  Story 7: ${entries.length} entries returned`);
  });

  it('Story 8: empty project — total beginner', async () => {
    fixtureDir = await createFixture({});

    const { profile, entries } = await solvePipeline(fixtureDir, 'help me build something');

    // Graceful degradation
    expect(profile.language).toEqual(['Unknown']);
    expect(profile.framework).toBeNull();

    // Universal entries still show
    expect(entries.length).toBeGreaterThan(0);

    const ids = entryIds(entries);
    // Only entries with no detect rules appear
    expect(ids).toContain('frontend-design');
    expect(ids).toContain('theme-factory');
    expect(ids).toContain('internal-comms');

    // Entries with detect rules should NOT appear
    expect(ids).not.toContain('stripe-best-practices');
    expect(ids).not.toContain('sentry-fix-issues');
    expect(ids).not.toContain('webapp-testing');

    console.log(`  Story 8: ${entries.length} universal entries for empty project`);
  });

  it('Story 9: Python project — non-JS builder', async () => {
    fixtureDir = await createFixture({
      'pyproject.toml': '[project]\nname = "my-python-app"\n',
      'src/main.py': 'print("hello")\n',
      'src/utils.py': 'def helper(): pass\n',
    });

    const { profile, entries } = await solvePipeline(fixtureDir, 'help me build this');
    const ids = entryIds(entries);

    // Language detection
    expect(profile.language).toContain('Python');

    // pyproject.toml matches
    expect(ids).toContain('pdf');
    expect(ids).toContain('webapp-testing');

    // JS-only entries should NOT show (no JS deps)
    expect(ids).not.toContain('stripe-best-practices');

    // Universal entries still present
    expect(ids).toContain('frontend-design');
    expect(ids).toContain('theme-factory');

    console.log(`  Story 9: ${entries.length} entries for Python project`);
  });

  it('Story 10: "mentat value" metric — rich project', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        react: '^18.0.0',
        '@sentry/nextjs': '^7.0.0',
        stripe: '^14.0.0',
        resend: '^3.0.0',
        tailwindcss: '^3.0.0',
        playwright: '^1.40.0',
      }),
      'tsconfig.json': '{}',
    });

    const { entries, response } = await solvePipeline(fixtureDir, 'add payments');
    const ids = entryIds(entries);

    // Significant number of entries
    expect(entries.length).toBeGreaterThan(8);

    // Multi-domain coverage
    const hasSentry = ids.some((id) => id.startsWith('sentry-'));
    const hasStripe = ids.includes('stripe-best-practices');
    const hasResend = ids.some((id) => ['send-email', 'resend-skills', 'templates'].includes(id));
    const hasDesign = ids.includes('frontend-design');
    const hasTesting = ids.some((id) => ['webapp-testing', 'web-artifacts-builder'].includes(id));

    expect(hasSentry).toBe(true);
    expect(hasStripe).toBe(true);
    expect(hasResend).toBe(true);
    expect(hasDesign).toBe(true);
    expect(hasTesting).toBe(true);

    // Every entry has a source field (backed by expert knowledge)
    for (const entry of entries) {
      expect(entry.source).toBeDefined();
    }

    // Context richness: Mentat provides substantially more context than just the task
    const mentatContext = entries
      .map((e) => `${e.description}\n${e.instructions ?? ''}`)
      .join('\n');
    expect(mentatContext.length).toBeGreaterThan(500);

    // The response itself is rich
    expect(response.length).toBeGreaterThan(500);

    console.log(`  Story 10: ${entries.length} entries, ${mentatContext.length} chars of expert context`);
    console.log(`  Domains: sentry=${hasSentry}, stripe=${hasStripe}, resend=${hasResend}, design=${hasDesign}, testing=${hasTesting}`);
  });
});

// ─── Performance Tests ──────────────────────────────────────────────

describe('solve performance', () => {
  afterEach(async () => {
    if (fixtureDir) await cleanupFixture(fixtureDir);
  });

  it('detect cold — realistic project under 200ms', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        react: '^18.0.0',
        '@sentry/nextjs': '^7.0.0',
        stripe: '^14.0.0',
      }),
      'tsconfig.json': '{}',
      'vercel.json': '{}',
      'src/index.ts': 'export default {}',
      'src/app/page.tsx': 'export default function() { return <div /> }',
    });

    clearDetectCache();
    const start = performance.now();
    await detectProjectContext(fixtureDir);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
    console.log(`  detect cold: ${elapsed.toFixed(1)}ms`);
  });

  it('detect warm — cache hit under 5ms', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({ next: '^14.0.0' }),
      'tsconfig.json': '{}',
    });

    clearDetectCache();
    await detectProjectContext(fixtureDir); // warm up cache

    const start = performance.now();
    await detectProjectContext(fixtureDir);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5);
    console.log(`  detect warm: ${elapsed.toFixed(2)}ms`);
  });

  it('full pipeline — detect + catalog 26 entries + filter + format under 500ms', async () => {
    fixtureDir = await createFixture({
      'package.json': packageJson({
        next: '^14.0.0',
        react: '^18.0.0',
        '@sentry/nextjs': '^7.0.0',
        stripe: '^14.0.0',
        resend: '^3.0.0',
        tailwindcss: '^3.0.0',
        playwright: '^1.40.0',
      }),
      'tsconfig.json': '{}',
    });

    clearDetectCache();
    const start = performance.now();
    const { entries } = await solvePipeline(fixtureDir, 'add payments');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    console.log(`  full pipeline: ${elapsed.toFixed(1)}ms (${entries.length} entries)`);
  });
});
