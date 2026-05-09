// ──────────────────────────────────────────────────────────
// Citation Verifier — Programmatic (no AI)
// ──────────────────────────────────────────────────────────

import { Citation, CitationCheck, RepoData } from '../agent/types';
import { fetchFileContent } from '../github/cloner';
import { parseGitHubUrl } from '../github/parser';

/**
 * Extracts citations from an answer string.
 * Supports formats:
 *  - [filename:L42-L58]
 *  - [filename:L42]
 *  - [filename]
 */
export function extractCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  // Match [path:Lstart-Lend] or [path:Lnum] or [path]
  const regex = /\[([^\]]+?(?:\.\w+))(?::L(\d+)(?:-L(\d+))?)?\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const file = match[1].trim();
    const startLine = match[2] ? parseInt(match[2], 10) : 0;
    const endLine = match[3] ? parseInt(match[3], 10) : startLine;

    citations.push({
      file,
      startLine,
      endLine,
      raw: match[0],
    });
  }

  return citations;
}

/**
 * Programmatically verifies all citations in an answer against the actual repo.
 * This is deterministic — no AI involved.
 */
export async function verifyCitations(
  citations: Citation[],
  repo: RepoData,
  token?: string
): Promise<CitationCheck[]> {
  if (citations.length === 0) return [];

  const parsed = parseGitHubUrl(`https://github.com/${repo.owner}/${repo.repo}`);
  parsed.branch = repo.branch;

  const checks: CitationCheck[] = [];

  for (const citation of citations) {
    const check: CitationCheck = {
      citation,
      fileExists: false,
      linesExist: false,
      contentMatches: false,
      verdict: 'invalid',
    };

    // 1. Check if file exists
    const fileExists = repo.tree.includes(citation.file);
    if (!fileExists) {
      // Try fuzzy match
      const fuzzy = repo.tree.find(p =>
        p.endsWith(citation.file) || citation.file.endsWith(p.split('/').pop() || '')
      );
      if (fuzzy) {
        check.fileExists = true;
        check.reason = `File found at "${fuzzy}" (citation used "${citation.file}")`;
        check.verdict = 'partial';
      } else {
        check.reason = `File "${citation.file}" does not exist in the repository`;
        check.verdict = 'invalid';
      }
      checks.push(check);
      continue;
    }
    check.fileExists = true;

    // 2. If no line numbers, just verify file exists
    if (citation.startLine === 0) {
      check.linesExist = true;
      check.contentMatches = true;
      check.verdict = 'verified';
      checks.push(check);
      continue;
    }

    // 3. Fetch file content and verify lines
    try {
      const content = await fetchFileContent(parsed, citation.file, token);
      const lines = content.split('\n');
      const totalLines = lines.length;

      if (citation.startLine > totalLines || citation.endLine > totalLines) {
        check.linesExist = false;
        check.reason = `File has ${totalLines} lines, but citation references L${citation.startLine}-L${citation.endLine}`;
        check.verdict = 'invalid';
      } else {
        check.linesExist = true;
        check.contentMatches = true;
        check.actualContent = lines
          .slice(citation.startLine - 1, citation.endLine)
          .join('\n');
        check.verdict = 'verified';
      }
    } catch (err) {
      check.reason = `Error fetching file: ${err instanceof Error ? err.message : 'Unknown'}`;
      check.verdict = 'invalid';
    }

    checks.push(check);
  }

  return checks;
}
