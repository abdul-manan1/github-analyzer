// ──────────────────────────────────────────────────────────
// GitHub Repo Cloner (Local Git Clone)
// ──────────────────────────────────────────────────────────

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { ParsedRepo, RepoData, RepoFile } from '../agent/types';
import { parseGitHubUrl } from './parser';

const execAsync = promisify(exec);

// In-memory cache of cloned repos
const repoCache = new Map<string, RepoData>();

const REPO_BASE_DIR = '/tmp/codebase-investigator';

/** File extensions we skip (binaries, images, etc.) */
const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.ogg', '.webm',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib',
  '.pyc', '.class', '.o',
  '.lock', '.min.js', '.min.css',
]);

function shouldSkipFile(filePath: string): boolean {
  const ext = '.' + filePath.split('.').pop()?.toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return true;
  // Skip paths in typical build/dependency dirs
  if (filePath.includes('node_modules/')) return true;
  if (filePath.includes('.git/')) return true;
  if (filePath.includes('dist/')) return true;
  if (filePath.includes('build/')) return true;
  if (filePath.includes('.next/')) return true;
  if (filePath.includes('vendor/')) return true;
  return false;
}

/**
 * Recursively gets all files in a directory
 */
async function getFilesRecursive(dir: string, baseDir: string): Promise<RepoFile[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files: RepoFile[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (shouldSkipFile(relPath)) continue;

    if (entry.isDirectory()) {
      files.push(...await getFilesRecursive(fullPath, baseDir));
    } else {
      const stats = await fs.promises.stat(fullPath);
      // Skip files > 1MB
      if (stats.size > 1_000_000) continue;
      files.push({
        path: relPath,
        size: stats.size,
        sha: '', // Not used in local clone
      });
    }
  }

  return files;
}

/**
 * Clones a repo locally using git clone --depth 1
 */
export async function cloneRepo(repoUrl: string, token?: string): Promise<RepoData> {
  const parsed = parseGitHubUrl(repoUrl);
  const cacheKey = `${parsed.owner}/${parsed.repo}`;

  // Return cached if available and less than 60 minutes old
  const cached = repoCache.get(cacheKey);
  if (cached && Date.now() - cached.clonedAt < 60 * 60 * 1000) {
    return cached;
  }

  const localPath = path.join(REPO_BASE_DIR, parsed.owner, parsed.repo);
  
  // Ensure base dir exists
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  let cloneUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
  if (token) {
    cloneUrl = `https://${token}@github.com/${parsed.owner}/${parsed.repo}.git`;
  }

  // If directory exists, we could pull, but for simplicity, let's remove and clone fresh
  if (fs.existsSync(localPath)) {
    await fs.promises.rm(localPath, { recursive: true, force: true });
  }

  try {
    await execAsync(`git clone --depth 1 ${cloneUrl} ${localPath}`);
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Index the files
  const files = await getFilesRecursive(localPath, localPath);

  const repoData: RepoData = {
    owner: parsed.owner,
    repo: parsed.repo,
    branch: parsed.branch,
    description: '', // We skip fetching description to save API calls
    language: 'Mixed', // Hard to determine without API, fallback
    stars: 0,
    files,
    tree: files.map(f => f.path),
    clonedAt: Date.now(),
  };

  repoCache.set(cacheKey, repoData);
  return repoData;
}

/**
 * Gets a cached repo data
 */
export function getCachedRepo(repoUrl: string): RepoData | undefined {
  const parsed = parseGitHubUrl(repoUrl);
  return repoCache.get(`${parsed.owner}/${parsed.repo}`);
}

/**
 * Fetches the content of a single file from the local clone
 */
export async function fetchFileContent(
  parsed: ParsedRepo,
  filePath: string,
  token?: string
): Promise<string> {
  const localPath = path.join(REPO_BASE_DIR, parsed.owner, parsed.repo, filePath);
  try {
    return await fs.promises.readFile(localPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Expose local path helper for fast grep
 */
export function getLocalRepoPath(owner: string, repo: string): string {
  return path.join(REPO_BASE_DIR, owner, repo);
}
