// ──────────────────────────────────────────────────────────
// API: POST /api/audit — Standalone re-audit endpoint
// ──────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getCachedRepo } from '@/lib/github/cloner';
import { runAuditor } from '@/lib/agent/auditor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, answer, toolCalls, repoUrl, conversationId, geminiApiKey, githubToken } = body;

    if (!question || !answer || !repoUrl || !conversationId || !geminiApiKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const repo = getCachedRepo(repoUrl);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not loaded. Please load the repository first.' },
        { status: 400 }
      );
    }

    const audit = await runAuditor(
      question,
      answer,
      toolCalls || [],
      repo,
      conversationId,
      geminiApiKey,
      githubToken,
    );

    return NextResponse.json({ success: true, audit });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Audit failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
