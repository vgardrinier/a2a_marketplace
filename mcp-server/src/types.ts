/**
 * Shared types for the Mentat MCP server
 */

export type EntryType = 'skill' | 'cli' | 'mcp' | 'agent';

export interface CatalogEntry {
  id: string;
  type: EntryType;
  name: string;
  description: string;
  instructions: string;

  detect?: {
    files?: string[];
    dependencies?: string[];
    exclude_files?: string[];
  };

  // Skill-specific (optional) — enables file context gathering
  context_patterns?: string[];
  examples?: string;

  // Index-only fields — instructions fetched at runtime from source
  source?: string;            // "github:owner/repo/path" or raw URL to SKILL.md
  stars?: number;             // GitHub stars for quality signal
}

export interface ProjectProfile {
  language: string[];
  framework: string | null;
  dependencies: string[];
  configs: string[];
  packageManager: string | null;
  fileTypes: string[];
}
