// ──────────────────────────────────────────────────────────
// Agent Tools — Local Filesystem Execution
// ──────────────────────────────────────────────────────────

import { RepoData, ToolCall } from './types';
import { fetchFileContent, getLocalRepoPath } from '../github/cloner';
import { parseGitHubUrl } from '../github/parser';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { SchemaType } from '@google/generative-ai';

const execAsync = promisify(exec);

export const TOOL_DECLARATIONS = [
  {
    name: 'list_structure',
    description: 'List the file and folder structure of the repository. Use this to understand the project layout before diving into specific files. Returns a tree of all file paths.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path_prefix: {
          type: SchemaType.STRING,
          description: 'Optional prefix to filter the tree. E.g., "src/components" to only list files under that directory. Leave empty for the full tree.',
        },
        max_depth: {
          type: SchemaType.NUMBER,
          description: 'Maximum directory depth to show. Default is 4.',
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a specific file in the repository. You can optionally specify a line range to read only a portion. Returns the file content with line numbers.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        path: {
          type: SchemaType.STRING,
          description: 'The file path relative to the repository root. E.g., "src/auth/middleware.ts"',
        },
        start_line: {
          type: SchemaType.NUMBER,
          description: 'Optional. Start line number (1-indexed). If omitted, reads from the beginning.',
        },
        end_line: {
          type: SchemaType.NUMBER,
          description: 'Optional. End line number (1-indexed, inclusive). If omitted, reads to the end.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name or glob pattern. Use this to find files related to a topic. Returns matching file paths.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Search query. Can be a filename, partial name, or keyword. E.g., "auth", "middleware", "config"',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'grep_code',
    description: 'Search for a text pattern across all files in the codebase. Returns matching lines with file paths and line numbers. Use this to find function definitions, imports, usages, etc.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        pattern: {
          type: SchemaType.STRING,
          description: 'The text or regex pattern to search for. E.g., "async function authenticate", "import.*jwt", "TODO"',
        },
        file_pattern: {
          type: SchemaType.STRING,
          description: 'Optional. Only search in files matching this pattern. E.g., "*.ts", "*.py", "src/**"',
        },
        case_sensitive: {
          type: SchemaType.BOOLEAN,
          description: 'Whether the search is case-sensitive. Default is false.',
        },
      },
      required: ['pattern'],
    },
  },
];

// ──────────────────────────────────────────────────────────
// Tool Executors
// ──────────────────────────────────────────────────────────

function executeListStructure(
  repo: RepoData,
  args: { path_prefix?: string; max_depth?: number }
): string {
  let paths = repo.tree;
  const prefix = args.path_prefix || '';
  const maxDepth = args.max_depth || 4;

  if (prefix) {
    paths = paths.filter(p => p.startsWith(prefix));
  }

  // Filter by depth
  paths = paths.filter(p => {
    const depth = p.split('/').length;
    return depth <= maxDepth;
  });

  if (paths.length === 0) {
    return `No files found${prefix ? ` under "${prefix}"` : ''}`;
  }

  const tree = paths
    .sort()
    .map(p => {
      const file = repo.files.find(f => f.path === p);
      const size = file ? ` (${formatSize(file.size)})` : '';
      return `  ${p}${size}`;
    })
    .join('\n');

  return `Repository structure${prefix ? ` under "${prefix}"` : ''} (${paths.length} files):\n${tree}`;
}

async function executeReadFile(
  repo: RepoData,
  args: { path: string; start_line?: number; end_line?: number },
  token?: string
): Promise<string> {
  const { path, start_line, end_line } = args;

  // Check if file exists
  if (!repo.tree.includes(path)) {
    const similar = repo.tree.filter(p =>
      p.toLowerCase().includes(path.toLowerCase()) ||
      path.toLowerCase().includes(p.split('/').pop()?.toLowerCase() || '')
    ).slice(0, 5);

    let msg = `File not found: "${path}"`;
    if (similar.length > 0) {
      msg += `\nDid you mean one of these?\n${similar.map(s => `  - ${s}`).join('\n')}`;
    }
    return msg;
  }

  const parsed = parseGitHubUrl(`https://github.com/${repo.owner}/${repo.repo}`);

  try {
    const content = await fetchFileContent(parsed, path, token);
    const lines = content.split('\n');

    const start = Math.max(1, start_line || 1);
    const end = Math.min(lines.length, end_line || lines.length);

    const numberedLines = lines
      .slice(start - 1, end)
      .map((line, i) => `${String(start + i).padStart(4, ' ')} | ${line}`)
      .join('\n');

    const rangeInfo = (start_line || end_line)
      ? ` (lines ${start}-${end} of ${lines.length})`
      : ` (${lines.length} lines)`;

    return `File: ${path}${rangeInfo}\n${'─'.repeat(60)}\n${numberedLines}`;
  } catch (err) {
    return `Error reading file "${path}": ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

function executeSearchFiles(
  repo: RepoData,
  args: { query: string }
): string {
  const query = args.query.toLowerCase();
  const matches = repo.tree.filter(p => {
    const filename = p.split('/').pop()?.toLowerCase() || '';
    const pathLower = p.toLowerCase();
    return filename.includes(query) || pathLower.includes(query);
  });

  if (matches.length === 0) {
    return `No files matching "${args.query}". Try a broader search term.`;
  }

  const limited = matches.slice(0, 50);
  const result = limited.map(p => {
    const file = repo.files.find(f => f.path === p);
    const size = file ? ` (${formatSize(file.size)})` : '';
    return `  ${p}${size}`;
  }).join('\n');

  const more = matches.length > 50 ? `\n  ... and ${matches.length - 50} more` : '';
  return `Files matching "${args.query}" (${matches.length} results):\n${result}${more}`;
}

async function executeGrepCode(
  repo: RepoData,
  args: { pattern: string; file_pattern?: string; case_sensitive?: boolean }
): Promise<string> {
  const { pattern, file_pattern, case_sensitive } = args;
  const localDir = getLocalRepoPath(repo.owner, repo.repo);

  try {
    // Escape pattern for ripgrep/grep
    const escapedPattern = pattern.replace(/"/g, '\\"');
    const caseFlag = case_sensitive ? '' : '-i';
    
    // Use git grep which is extremely fast and respects .gitignore
    // We run it inside the local clone directory
    let command = `git grep -n ${caseFlag} "${escapedPattern}"`;
    
    if (file_pattern) {
      // Clean up file pattern if it's just an extension
      const cleanedPattern = file_pattern.replace(/^\*/, '');
      command += ` -- "*${cleanedPattern}*"`;
    }

    try {
      const { stdout } = await execAsync(command, { cwd: localDir });
      
      const lines = stdout.split('\n').filter(Boolean);
      
      if (lines.length === 0) {
        return `No matches found for pattern "${pattern}".`;
      }

      // Limit results to prevent massive token usage
      const limit = 40;
      const limitedLines = lines.slice(0, limit);
      
      const formatted = limitedLines.map(line => `  ${line}`).join('\n');
      const more = lines.length > limit ? `\n\n... and ${lines.length - limit} more matches.` : '';

      return `Matches for "${pattern}" (${lines.length} results):\n${formatted}${more}`;
    } catch (e: any) {
      // git grep exits with 1 if no matches found
      if (e.code === 1) {
        return `No matches found for pattern "${pattern}".`;
      }
      throw e;
    }

  } catch (err) {
    return `Error running grep: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

// ──────────────────────────────────────────────────────────
// Execute a tool call
// ──────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  repo: RepoData,
  token?: string
): Promise<ToolCall> {
  const id = `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let result: string;

  try {
    switch (toolName) {
      case 'list_structure':
        result = executeListStructure(repo, args as { path_prefix?: string; max_depth?: number });
        break;
      case 'read_file':
        result = await executeReadFile(repo, args as { path: string; start_line?: number; end_line?: number }, token);
        break;
      case 'search_files':
        result = executeSearchFiles(repo, args as { query: string });
        break;
      case 'grep_code':
        result = await executeGrepCode(repo, args as { pattern: string; file_pattern?: string; case_sensitive?: boolean });
        break;
      default:
        result = `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    result = `Error executing ${toolName}: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }

  return { id, name: toolName, args, result, timestamp: Date.now() };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
