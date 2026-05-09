// ──────────────────────────────────────────────────────────
// GitHub URL Parser
// ──────────────────────────────────────────────────────────

import { ParsedRepo } from '../agent/types';

/**
 * Parses a GitHub URL into its components.
 * Supports:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo/tree/branch
 *  - https://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): ParsedRepo {
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');

  const patterns = [
    // https://github.com/owner/repo/tree/branch
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)/,
    // https://github.com/owner/repo
    /github\.com\/([^/]+)\/([^/]+)/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        branch: match[3] || 'main',
        fullUrl: cleaned,
      };
    }
  }

  throw new Error(`Invalid GitHub URL: ${url}. Expected format: https://github.com/owner/repo`);
}

/**
 * Validates that a string looks like a GitHub URL
 */
export function isValidGitHubUrl(url: string): boolean {
  try {
    parseGitHubUrl(url);
    return true;
  } catch {
    return false;
  }
}
