import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { glob } from 'glob';
import type { CatalogEntry, ProjectProfile } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundled catalog lives one level up from dist/ at mcp-server/catalog/
const BUNDLED_CATALOG_DIR = path.resolve(__dirname, '..', 'catalog');

// Cache for fetched SKILL.md content
const CACHE_DIR = path.join(os.homedir(), '.mentat', 'skills');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class CatalogLibrary {
  private bundledCatalogDir: string;

  constructor(private workspacePath: string, bundledCatalogDir?: string) {
    this.bundledCatalogDir = bundledCatalogDir ?? BUNDLED_CATALOG_DIR;
  }

  /**
   * Load all catalog entries from bundled + project sources,
   * then filter by project profile.
   */
  async getRelevantEntries(profile: ProjectProfile): Promise<CatalogEntry[]> {
    const [bundled, project] = await Promise.all([
      this.loadBundledCatalog(),
      this.loadProjectCatalog(),
    ]);

    // Project overrides bundled by id
    const byId = new Map<string, CatalogEntry>();
    for (const entry of bundled) byId.set(entry.id, entry);
    for (const entry of project) byId.set(entry.id, entry);

    const all = Array.from(byId.values());
    return all.filter((entry) => this.matchesProfile(entry, profile));
  }

  /**
   * Load a single entry by id.
   * If the entry has a source URL and no inline instructions,
   * fetches SKILL.md from the source at runtime (with cache).
   */
  async getEntryById(id: string): Promise<CatalogEntry | null> {
    // Check project catalog first
    const projectPath = path.join(this.workspacePath, 'mentat-catalog', `${id}.yaml`);
    const entry = await this.loadYamlEntry(projectPath);
    if (entry) return this.resolveSource(entry);

    // Then bundled catalog
    const bundledFiles = await glob('**/*.yaml', { cwd: this.bundledCatalogDir, absolute: true });
    for (const file of bundledFiles) {
      const e = await this.loadYamlEntry(file);
      if (e && e.id === id) return this.resolveSource(e);
    }

    return null;
  }

  /**
   * If entry has a source and no real instructions, fetch SKILL.md content.
   */
  private async resolveSource(entry: CatalogEntry): Promise<CatalogEntry> {
    if (!entry.source) return entry;
    // If instructions is already populated with real content (not just the description fallback)
    if (entry.instructions && entry.instructions !== entry.description) return entry;

    const instructions = await this.fetchFromSource(entry.id, entry.source);
    if (instructions) {
      return { ...entry, instructions };
    }
    return entry;
  }

  /**
   * Fetch SKILL.md content from a source URL.
   * Supports "github:owner/repo/path" shorthand and raw URLs.
   * Caches to ~/.mentat/skills/{id}/latest.md with 24h TTL.
   */
  private async fetchFromSource(id: string, source: string): Promise<string | null> {
    // Check cache first
    const cachePath = path.join(CACHE_DIR, id, 'latest.md');
    try {
      const stat = await fs.stat(cachePath);
      if (Date.now() - stat.mtimeMs < CACHE_TTL) {
        return await fs.readFile(cachePath, 'utf-8');
      }
    } catch { /* cache miss */ }

    // Resolve source to a raw URL
    const url = this.resolveSourceUrl(source);
    if (!url) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch skill ${id} from ${url}: ${response.statusText}`);
        return null;
      }

      const content = await response.text();

      // Parse SKILL.md — extract instructions from markdown body (skip YAML frontmatter)
      const instructions = this.parseSkillMd(content);

      // Cache it
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, instructions);

      return instructions;
    } catch (error) {
      console.error(`Failed to fetch skill ${id}:`, error);
      return null;
    }
  }

  /**
   * Convert source shorthand to a raw URL.
   * "github:owner/repo/path/to/dir" → raw.githubusercontent.com/.../SKILL.md
   * Handles both directory refs (appends /SKILL.md) and direct file refs.
   */
  private resolveSourceUrl(source: string): string | null {
    if (source.startsWith('github:')) {
      // source = "github:owner/repo/path/to/skill-dir"
      // We need: https://raw.githubusercontent.com/owner/repo/main/path/to/skill-dir/SKILL.md
      const ghPath = source.slice('github:'.length);
      const parts = ghPath.split('/');
      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1];
      const skillPath = parts.slice(2).join('/');

      // If path already ends with .md, use as-is; otherwise append /SKILL.md
      const filePath = skillPath.endsWith('.md') ? skillPath : `${skillPath}/SKILL.md`;
      return `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return source;
    }
    return null;
  }

  /**
   * Parse SKILL.md content — strip YAML frontmatter, return markdown body.
   */
  private parseSkillMd(content: string): string {
    const trimmed = content.trim();
    if (trimmed.startsWith('---')) {
      const endIndex = trimmed.indexOf('---', 3);
      if (endIndex !== -1) {
        return trimmed.slice(endIndex + 3).trim();
      }
    }
    return trimmed;
  }

  private async loadBundledCatalog(): Promise<CatalogEntry[]> {
    return this.loadYamlDir(this.bundledCatalogDir);
  }

  private async loadProjectCatalog(): Promise<CatalogEntry[]> {
    const dir = path.join(this.workspacePath, 'mentat-catalog');
    return this.loadYamlDir(dir);
  }

  /**
   * Load all YAML files from a directory (recursively)
   */
  private async loadYamlDir(dir: string): Promise<CatalogEntry[]> {
    try {
      await fs.access(dir);
    } catch {
      return [];
    }

    const files = await glob('**/*.yaml', { cwd: dir, absolute: true });
    const entries: CatalogEntry[] = [];
    for (const file of files) {
      const entry = await this.loadYamlEntry(file);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  /**
   * Parse a single catalog YAML file (entry: root key)
   */
  private async loadYamlEntry(filePath: string): Promise<CatalogEntry | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = yaml.parse(raw);

      if (!parsed?.entry) return null;

      const e = parsed.entry;
      return {
        id: e.id,
        type: e.type ?? 'skill',
        name: e.name,
        description: e.description,
        instructions: e.instructions ?? e.description,
        detect: e.detect,
        context_patterns: e.context_patterns,
        examples: e.examples,
        source: e.source,
        stars: e.stars,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if a catalog entry's detect rules match the project profile.
   * No detect rules = always match.
   */
  private matchesProfile(entry: CatalogEntry, profile: ProjectProfile): boolean {
    const detect = entry.detect;
    if (!detect) return true;

    // Exclude: if any exclude_files exist in the project, skip this entry
    if (detect.exclude_files?.length) {
      const hasExcluded = detect.exclude_files.some((f) => profile.configs.includes(f));
      if (hasExcluded) return false;
    }

    // At least one detect rule must match (files OR dependencies)
    const hasFileRule = detect.files && detect.files.length > 0;
    const hasDepRule = detect.dependencies && detect.dependencies.length > 0;

    if (!hasFileRule && !hasDepRule) return true;

    const fileMatch = hasFileRule && detect.files!.some((f) => profile.configs.includes(f));
    const depMatch = hasDepRule && detect.dependencies!.some((d) => profile.dependencies.includes(d));

    return !!(fileMatch || depMatch);
  }
}
