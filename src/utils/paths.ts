import envPaths from "env-paths";
import fs from "node:fs";
import path from "node:path";

const paths = envPaths("yakky", { suffix: "" });

/**
 * Ensure a directory exists, creating it if necessary.
 */
function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export const dataPaths = {
  /** User data directory (databases, user-generated content). */
  data: paths.data,
  /** Configuration directory. */
  config: paths.config,
  /** Cache directory. */
  cache: paths.cache,
  /** Log directory. */
  log: paths.log,
  /** Temporary directory. */
  temp: paths.temp,
  /** Templates directory. */
  templates: path.join(paths.data, "templates"),

  /**
   * Ensure all directories exist.
   */
  ensure(): void {
    for (const dir of [
      paths.data,
      paths.config,
      paths.cache,
      paths.log,
      paths.temp,
      dataPaths.templates,
    ]) {
      ensureDir(dir);
    }
  },
};

/**
 * Get the full path to a file inside the user data directory.
 */
export function dataPath(...segments: string[]): string {
  const fullPath = path.join(paths.data, ...segments);
  ensureDir(path.dirname(fullPath));
  return fullPath;
}

/**
 * Get the full path to a file inside the user data directory.
 */
export function templatesPath(...segments: string[]): string {
  const fullPath = path.join(dataPaths.templates, ...segments);
  ensureDir(path.dirname(fullPath));
  return fullPath;
}

/**
 * Get the full path to a file inside the config directory.
 */
export function configPath(...segments: string[]): string {
  const fullPath = path.join(paths.config, ...segments);
  ensureDir(path.dirname(fullPath));
  return fullPath;
}

/**
 * Get the full path to a file inside the cache directory.
 */
export function cachePath(...segments: string[]): string {
  const fullPath = path.join(paths.cache, ...segments);
  ensureDir(path.dirname(fullPath));
  return fullPath;
}
