import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

/**
 * Create a temporary project directory with the given files.
 * Returns the absolute path. Caller must clean up via cleanupFixture().
 */
export async function createFixture(
  files: Record<string, string>,
): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mentat-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(dir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
  return dir;
}

export async function cleanupFixture(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

/** Shorthand: build a minimal package.json with given deps */
export function packageJson(
  deps: Record<string, string> = {},
  devDeps: Record<string, string> = {},
): string {
  return JSON.stringify(
    { name: 'test-project', version: '0.0.1', dependencies: deps, devDependencies: devDeps },
    null,
    2,
  );
}
