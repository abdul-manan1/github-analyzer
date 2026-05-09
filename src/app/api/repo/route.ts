// ──────────────────────────────────────────────────────────
// API: POST /api/repo — Clone & index a GitHub repository
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { cloneRepo } from '@/lib/github/cloner';
import { isValidGitHubUrl } from '@/lib/github/parser';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, githubToken } = body;

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Missing repoUrl parameter' },
        { status: 400 }
      );
    }

    if (!isValidGitHubUrl(repoUrl)) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' },
        { status: 400 }
      );
    }

    const repoData = await cloneRepo(repoUrl, githubToken);

    return NextResponse.json({
      success: true,
      data: {
        owner: repoData.owner,
        repo: repoData.repo,
        branch: repoData.branch,
        description: repoData.description,
        language: repoData.language,
        stars: repoData.stars,
        files: repoData.files,
        tree: repoData.tree,
        clonedAt: repoData.clonedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to clone repository';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
