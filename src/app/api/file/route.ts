// ──────────────────────────────────────────────────────────
// API: POST /api/file — Fetch file content for the viewer
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getCachedRepo, fetchFileContent } from '@/lib/github/cloner';
import { parseGitHubUrl } from '@/lib/github/parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, filePath, githubToken } = body;

    if (!repoUrl || !filePath) {
      return NextResponse.json(
        { error: 'Missing repoUrl or filePath' },
        { status: 400 }
      );
    }

    const repo = getCachedRepo(repoUrl);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not loaded' },
        { status: 400 }
      );
    }

    const parsed = parseGitHubUrl(repoUrl);
    parsed.branch = repo.branch;

    const content = await fetchFileContent(parsed, filePath, githubToken);

    return NextResponse.json({
      success: true,
      content,
      totalLines: content.split('\n').length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
