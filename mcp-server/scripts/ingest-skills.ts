#!/usr/bin/env npx tsx
/**
 * Automated skill ingestion: crawls GitHub repos, discovers SKILL.md files,
 * parses frontmatter, auto-generates detect rules, outputs lightweight YAML index.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... npx tsx scripts/ingest-skills.ts
 *
 * What it does:
 * 1. For each source repo, fetches the full file tree via GitHub API
 * 2. Finds all SKILL.md files
 * 3. Fetches each SKILL.md, parses YAML frontmatter (name, description)
 * 4. Scans body for framework/tool mentions → auto-generates detect rules
 * 5. Outputs lightweight YAML index files to catalog/skills/
 *
 * No manual curation — scales to thousands of skills.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '..', 'catalog', 'skills');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN required. Set it to avoid rate limits and access repo trees.');
  console.error('Usage: GITHUB_TOKEN=ghp_... npx tsx scripts/ingest-skills.ts');
  process.exit(1);
}

// --- Configuration: repos to crawl ---

interface SourceRepo {
  repo: string;       // "owner/repo"
  branch: string;
  pathPrefix: string;  // where to look for skills (e.g. "skills/")
  idPrefix?: string;   // optional prefix for generated IDs to avoid collisions
}

const SOURCES: SourceRepo[] = [
  // Official Anthropic skills (78K+ stars)
  { repo: 'anthropics/skills', branch: 'main', pathPrefix: 'skills/' },
  // Official team repos — high-quality, maintained by the service teams themselves
  { repo: 'stripe/agent-toolkit', branch: 'main', pathPrefix: 'skills/' },
  { repo: 'getsentry/sentry-agent-skills', branch: 'main', pathPrefix: 'skills/' },
  { repo: 'resend/resend-skills', branch: 'main', pathPrefix: '' },
  // To add more sources, append here. Example:
  // { repo: 'affaan-m/everything-claude-code', branch: 'main', pathPrefix: 'skills/', idPrefix: 'ecc-' },
];

// Persona filter: skip skills matching these patterns (case-insensitive)
// Target: tech-savvy Claude Code user shipping web apps (JS/TS/Python)
const SKIP_PATTERNS = [
  // Mobile native
  /\bmobile[-\s]native\b/i, /\bflutter\b/i, /\bswift\b/i, /\bkotlin\b/i,
  /\bandroid\b/i, /\bios\b/i, /\breact[-\s]native\b/i, /\bexpo\b/i,
  // ML / Data science
  /\bmachine[-\s]learning\b/i, /\bdata[-\s]science\b/i, /\bjupyter\b/i,
  /\btensorflow\b/i, /\bpytorch\b/i,
  // Game / Hardware / Embedded
  /\bunity\b/i, /\bunreal\b/i, /\bgame[-\s]engine\b/i, /\bhardware\b/i,
  /\barduino\b/i, /\braspberry\b/i, /\bembedded[-\s]system/i,
  // Legacy / niche languages
  /\bmatlab\b/i, /\bfortran\b/i, /\bcobol\b/i,
  // Enterprise Java / .NET / legacy ecosystems (not our persona)
  /\bspring[-\s]boot\b/i, /\bspringboot\b/i, /\bjpa\b/i, /\bjava\b/i,
  /\b\.net\b/i, /\bcsharp\b/i, /\bc#\b/i,
  // Niche ecosystems outside web dev
  /\bruby\b/i, /\brails\b/i, /\belixir\b/i, /\bphoenix\b/i,
  /\bcocoa\b/i, /\bobjective-c\b/i,
];

// Detect rules: map keywords found in SKILL.md body → dependency/file detect rules
const DEPENDENCY_KEYWORDS: Record<string, string[]> = {
  // JS/TS frameworks
  'next': ['next.js', 'nextjs', 'next/'],
  'react': ['react component', 'react hook', 'usestate', 'useeffect', 'jsx'],
  'vue': ['vue component', 'vuex', 'pinia', 'nuxt'],
  'svelte': ['svelte', 'sveltekit'],
  'express': ['express middleware', 'express.router', 'app.get(', 'app.post('],
  'hono': ['hono'],
  'fastify': ['fastify'],
  'tailwindcss': ['tailwind', 'tailwindcss'],
  '@modelcontextprotocol/sdk': ['model context protocol', 'mcp server', 'mcp tool'],
  'prisma': ['prisma'],
  'drizzle-orm': ['drizzle'],
  'stripe': ['stripe'],
  '@sentry/nextjs': ['sentry'],
  'vitest': ['vitest'],
  'playwright': ['playwright'],
  'resend': ['resend'],
  // Non-JS ecosystems (for filtering)
  'spring-boot': ['spring boot', 'springboot', '@springboot', '@restcontroller', 'spring framework'],
  'django': ['django', 'djangorestframework', 'drf'],
  'flask': ['flask'],
  'rails': ['ruby on rails', 'rails'],
  'laravel': ['laravel'],
};

const FILE_KEYWORDS: Record<string, string[]> = {
  'Dockerfile': ['dockerfile', 'docker compose', 'containeriz'],
  '.github': ['github actions', 'github workflow'],
  'tailwind.config': ['tailwind config'],
  // Non-JS ecosystems
  'go.mod': ['go module', 'go test', 'go func', 'golang', ' go '],
  'pom.xml': ['maven', 'pom.xml', 'java', 'spring boot', 'springboot'],
  'build.gradle': ['gradle', 'build.gradle'],
  'pyproject.toml': ['python', 'pyproject', 'django', 'flask', 'pip install'],
  'Cargo.toml': ['cargo', 'rust', 'crate'],
  'Gemfile': ['ruby', 'rails', 'gem '],
};

// --- GitHub API helpers ---

const headers = {
  'Accept': 'application/vnd.github.v3+json',
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

async function ghGet(url: string): Promise<any> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText} (${url})`);
  }
  return response.json();
}

async function getRepoStars(repo: string): Promise<number> {
  const data = await ghGet(`https://api.github.com/repos/${repo}`);
  return data.stargazers_count;
}

async function getFileTree(repo: string, branch: string): Promise<string[]> {
  const data = await ghGet(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`
  );
  return data.tree
    .filter((t: any) => t.type === 'blob')
    .map((t: any) => t.path);
}

async function getFileContent(repo: string, branch: string, filePath: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.text();
}

// --- SKILL.md parsing ---

interface ParsedSkill {
  name: string;
  description: string;
  body: string;
}

function parseSkillMd(content: string): ParsedSkill | null {
  const trimmed = content.trim();

  // Parse YAML frontmatter
  if (trimmed.startsWith('---')) {
    const endIdx = trimmed.indexOf('---', 3);
    if (endIdx === -1) return null;

    const frontmatterStr = trimmed.slice(3, endIdx).trim();
    const body = trimmed.slice(endIdx + 3).trim();

    try {
      const frontmatter = yaml.parse(frontmatterStr);
      if (!frontmatter?.name && !frontmatter?.description) return null;

      return {
        name: frontmatter.name || '',
        description: frontmatter.description || '',
        body,
      };
    } catch {
      return null;
    }
  }

  // No frontmatter — try to extract name from first heading
  const headingMatch = trimmed.match(/^#\s+(.+)/m);
  if (headingMatch) {
    // Use first paragraph after heading as description
    const afterHeading = trimmed.slice(headingMatch.index! + headingMatch[0].length).trim();
    const firstPara = afterHeading.split('\n\n')[0]?.trim() || '';
    return {
      name: headingMatch[1].trim(),
      description: firstPara.slice(0, 200),
      body: trimmed,
    };
  }

  return null;
}

// --- Detect rule generation ---

function generateDetectRules(body: string): { dependencies?: string[]; files?: string[] } {
  const lowerBody = body.toLowerCase();
  const deps: string[] = [];
  const files: string[] = [];

  for (const [dep, keywords] of Object.entries(DEPENDENCY_KEYWORDS)) {
    if (keywords.some(kw => lowerBody.includes(kw))) {
      deps.push(dep);
    }
  }

  for (const [file, keywords] of Object.entries(FILE_KEYWORDS)) {
    if (keywords.some(kw => lowerBody.includes(kw))) {
      files.push(file);
    }
  }

  const result: { dependencies?: string[]; files?: string[] } = {};
  if (deps.length > 0) result.dependencies = deps;
  if (files.length > 0) result.files = files;
  return result;
}

function generateContextPatterns(body: string): string[] {
  const lowerBody = body.toLowerCase();
  const patterns = new Set<string>();

  if (lowerBody.includes('tsx') || lowerBody.includes('jsx') || lowerBody.includes('react')) {
    patterns.add('**/*.tsx');
    patterns.add('**/*.jsx');
  }
  if (lowerBody.includes('typescript') || lowerBody.includes('.ts')) {
    patterns.add('**/*.ts');
  }
  if (lowerBody.includes('python') || lowerBody.includes('.py')) {
    patterns.add('**/*.py');
  }
  if (lowerBody.includes('vue')) {
    patterns.add('**/*.vue');
  }
  if (lowerBody.includes('svelte')) {
    patterns.add('**/*.svelte');
  }

  return Array.from(patterns);
}

// --- ID generation ---

function generateId(skillMdPath: string, source: SourceRepo): string {
  // Extract the skill folder name from the path
  // e.g. "skills/stripe/stripe-best-practices/SKILL.md" → "stripe-best-practices"
  const dir = path.dirname(skillMdPath);
  const parts = dir.split('/').filter(p => p !== '.');

  // For root-level SKILL.md, use repo name as fallback
  const folderName = parts.length > 0
    ? parts[parts.length - 1]
    : source.repo.split('/')[1];

  // Slugify
  const slug = folderName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return (source.idPrefix || '') + slug;
}

function shouldSkip(name: string, description: string, body: string): boolean {
  const combined = `${name} ${description} ${body}`;
  return SKIP_PATTERNS.some(pattern => pattern.test(combined));
}

// --- Name and description helpers ---

const SPECIAL_WORDS: Record<string, string> = {
  'api': 'API', 'mcp': 'MCP', 'css': 'CSS', 'html': 'HTML', 'js': 'JS',
  'ts': 'TS', 'ui': 'UI', 'ux': 'UX', 'seo': 'SEO', 'ci': 'CI', 'cd': 'CD',
  'ci/cd': 'CI/CD', 'sql': 'SQL', 'llm': 'LLM', 'ai': 'AI', 'pdf': 'PDF',
  'docx': 'DOCX', 'xlsx': 'XLSX', 'pptx': 'PPTX', 'tdd': 'TDD', 'e2e': 'E2E',
  'ssr': 'SSR', 'ssg': 'SSG', 'jwt': 'JWT', 'oauth': 'OAuth', 'graphql': 'GraphQL',
  'trpc': 'tRPC', 'nextjs': 'Next.js', 'vuejs': 'Vue.js', 'nodejs': 'Node.js',
  'ecc': 'ECC', 'va': 'VA', 'cpp': 'C++', 'io': 'I/O', 'cli': 'CLI',
  'jpa': 'JPA', 'django': 'Django', 'golang': 'Go',
};

function humanizeName(slug: string): string {
  return slug
    .split('-')
    .map(word => SPECIAL_WORDS[word.toLowerCase()] || (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function truncateCleanly(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  // Try to truncate at sentence boundary
  const truncated = text.slice(0, maxLen);
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > maxLen * 0.6) {
    return truncated.slice(0, lastSentence + 1);
  }
  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

// --- YAML output ---

function toYaml(entry: {
  id: string;
  name: string;
  description: string;
  source: string;
  stars?: number;
  detect?: { dependencies?: string[]; files?: string[] };
  context_patterns?: string[];
}): string {
  // Use the yaml library for proper escaping
  const obj = {
    entry: {
      id: entry.id,
      type: 'skill',
      name: entry.name,
      description: entry.description,
      source: entry.source,
      ...(entry.stars ? { stars: entry.stars } : {}),
      ...(entry.detect && Object.keys(entry.detect).length > 0 ? { detect: entry.detect } : {}),
      ...(entry.context_patterns?.length ? { context_patterns: entry.context_patterns } : {}),
    },
  };

  return yaml.stringify(obj);
}

// --- Main ---

interface DiscoveredSkill {
  id: string;
  name: string;
  description: string;
  source: string;
  stars: number;
  detect: { dependencies?: string[]; files?: string[] };
  context_patterns: string[];
}

async function ingestRepo(source: SourceRepo): Promise<DiscoveredSkill[]> {
  console.log(`\nCrawling ${source.repo}...`);

  const [stars, allFiles] = await Promise.all([
    getRepoStars(source.repo),
    getFileTree(source.repo, source.branch),
  ]);
  console.log(`  ${stars.toLocaleString()} stars, ${allFiles.length} files`);

  // Find SKILL.md files under pathPrefix
  const skillFiles = allFiles.filter(f => {
    if (!f.endsWith('SKILL.md')) return false;
    if (source.pathPrefix && !f.startsWith(source.pathPrefix)) return false;
    // Skip template files
    if (f.includes('template/')) return false;
    return true;
  });

  console.log(`  Found ${skillFiles.length} SKILL.md files`);

  const skills: DiscoveredSkill[] = [];
  let skipped = 0;
  let failed = 0;

  // Process in batches of 5 to avoid hammering the API
  for (let i = 0; i < skillFiles.length; i += 5) {
    const batch = skillFiles.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const content = await getFileContent(source.repo, source.branch, filePath);
          const parsed = parseSkillMd(content);
          if (!parsed) return null;

          if (shouldSkip(parsed.name, parsed.description, parsed.body)) {
            skipped++;
            return null;
          }

          const id = generateId(filePath, source);
          const dir = path.dirname(filePath);
          const detect = generateDetectRules(parsed.body);
          const contextPatterns = generateContextPatterns(parsed.body);

          // Always humanize — frontmatter "name" is typically a slug like "mcp-builder"
          const rawName = parsed.name || id.replace(source.idPrefix || '', '');
          const displayName = humanizeName(rawName);

          return {
            id,
            name: displayName,
            description: truncateCleanly(parsed.description, 300),
            source: `github:${source.repo}/${dir}`,
            stars,
            detect,
            context_patterns: contextPatterns,
          };
        } catch (err) {
          failed++;
          console.error(`  Failed: ${filePath}: ${err}`);
          return null;
        }
      })
    );

    for (const r of results) {
      if (r) skills.push(r);
    }
  }

  console.log(`  Ingested: ${skills.length}, Skipped: ${skipped}, Failed: ${failed}`);
  return skills;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const allSkills: DiscoveredSkill[] = [];
  const seenIds = new Set<string>();

  for (const source of SOURCES) {
    try {
      const skills = await ingestRepo(source);
      for (const skill of skills) {
        // Dedupe by id — first source wins
        if (seenIds.has(skill.id)) {
          console.log(`  Duplicate id "${skill.id}", skipping`);
          continue;
        }
        seenIds.add(skill.id);
        allSkills.push(skill);
      }
    } catch (err) {
      console.error(`Failed to ingest ${source.repo}: ${err}`);
    }
  }

  // Write YAML files
  console.log(`\nWriting ${allSkills.length} skill index files...`);
  for (const skill of allSkills) {
    const yamlContent = toYaml(skill);
    const filePath = path.join(OUTPUT_DIR, `${skill.id}.yaml`);
    await fs.writeFile(filePath, yamlContent);
  }

  console.log(`Done. ${allSkills.length} entries in ${OUTPUT_DIR}`);

  // Summary
  const bySource = new Map<string, number>();
  for (const s of allSkills) {
    const repo = s.source.split('/').slice(0, 2).join('/').replace('github:', '');
    bySource.set(repo, (bySource.get(repo) || 0) + 1);
  }
  console.log('\nBy source:');
  for (const [repo, count] of bySource) {
    console.log(`  ${repo}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
