import { promises as fs } from 'fs';
import path from 'path';
import type { ProjectProfile } from './types.js';

let cachedProfile: { profile: ProjectProfile; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

/** Reset detection cache — used in tests to isolate fixtures. */
export function clearDetectCache(): void {
  cachedProfile = null;
}

/**
 * Detect project context by reading common config files.
 * Results cached for 60s to avoid repeated disk reads.
 */
export async function detectProjectContext(workspacePath: string): Promise<ProjectProfile> {
  if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_TTL) {
    return cachedProfile.profile;
  }

  const [packageJson, configFiles, fileTypes, packageManager] = await Promise.all([
    readPackageJson(workspacePath),
    detectConfigFiles(workspacePath),
    detectFileTypes(workspacePath),
    detectPackageManager(workspacePath),
  ]);

  const language = detectLanguages(configFiles, fileTypes);
  const framework = detectFramework(packageJson);

  const profile: ProjectProfile = {
    language,
    framework,
    dependencies: packageJson?.allDeps ?? [],
    configs: configFiles,
    packageManager,
    fileTypes,
  };

  cachedProfile = { profile, timestamp: Date.now() };
  return profile;
}

interface ParsedPackageJson {
  allDeps: string[];
  scripts: string[];
}

async function readPackageJson(workspacePath: string): Promise<ParsedPackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(workspacePath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    const scripts = Object.keys(pkg.scripts ?? {});
    return { allDeps: [...deps, ...devDeps], scripts };
  } catch {
    return null;
  }
}

const CONFIG_FILES = [
  'tsconfig.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  'eslint.config.js',
  'eslint.config.mjs',
  '.prettierrc',
  'prettier.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'postcss.config.mjs',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.ts',
  'vite.config.js',
  'nuxt.config.ts',
  'svelte.config.js',
  'angular.json',
  'vercel.json',
  '.vercel',
  'netlify.toml',
  'fly.toml',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.github',
  '.gitlab-ci.yml',
  'prisma',
  'drizzle.config.ts',
];

async function detectConfigFiles(workspacePath: string): Promise<string[]> {
  const checks = CONFIG_FILES.map(async (file) => {
    try {
      await fs.access(path.join(workspacePath, file));
      return file;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(checks);
  return results.filter((f): f is string => f !== null);
}

async function detectFileTypes(workspacePath: string): Promise<string[]> {
  const types = new Set<string>();
  try {
    const entries = await fs.readdir(workspacePath, { withFileTypes: true });
    // Check top-level + one level deep for a quick census
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;

      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext) types.add(ext);
      } else if (entry.isDirectory()) {
        try {
          const subEntries = await fs.readdir(path.join(workspacePath, entry.name));
          for (const sub of subEntries.slice(0, 50)) {
            const ext = path.extname(sub);
            if (ext) types.add(ext);
          }
        } catch { /* skip unreadable dirs */ }
      }
    }
  } catch { /* empty if workspace unreadable */ }
  return Array.from(types);
}

function detectLanguages(configs: string[], fileTypes: string[]): string[] {
  const langs: string[] = [];
  if (configs.includes('tsconfig.json') || fileTypes.includes('.ts') || fileTypes.includes('.tsx')) {
    langs.push('TypeScript');
  }
  if (fileTypes.includes('.js') || fileTypes.includes('.jsx')) {
    langs.push('JavaScript');
  }
  if (configs.includes('pyproject.toml') || fileTypes.includes('.py')) {
    langs.push('Python');
  }
  if (configs.includes('Cargo.toml') || fileTypes.includes('.rs')) {
    langs.push('Rust');
  }
  if (configs.includes('go.mod') || fileTypes.includes('.go')) {
    langs.push('Go');
  }
  return langs.length > 0 ? langs : ['Unknown'];
}

function detectFramework(pkg: ParsedPackageJson | null): string | null {
  if (!pkg) return null;
  const deps = pkg.allDeps;
  if (deps.includes('next')) return 'Next.js';
  if (deps.includes('nuxt')) return 'Nuxt';
  if (deps.includes('@sveltejs/kit')) return 'SvelteKit';
  if (deps.includes('svelte')) return 'Svelte';
  if (deps.includes('@angular/core')) return 'Angular';
  if (deps.includes('vue')) return 'Vue';
  if (deps.includes('react')) return 'React';
  if (deps.includes('express')) return 'Express';
  if (deps.includes('fastify')) return 'Fastify';
  if (deps.includes('hono')) return 'Hono';
  return null;
}

async function detectPackageManager(workspacePath: string): Promise<string | null> {
  const lockFiles: [string, string][] = [
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ];

  for (const [file, manager] of lockFiles) {
    try {
      await fs.access(path.join(workspacePath, file));
      return manager;
    } catch { /* not found, continue */ }
  }
  return null;
}
