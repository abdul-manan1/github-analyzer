// ──────────────────────────────────────────────────────────
// API: POST /api/chat — Main chat with streaming
// ──────────────────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { getCachedRepo, cloneRepo } from '@/lib/github/cloner';
import { runInvestigator } from '@/lib/agent/investigator';
import { runAuditor } from '@/lib/agent/auditor';
import { extractCitations } from '@/lib/citations/verifier';
import {
  getConversation,
  addMessage,
  updateLastMessage,
} from '@/lib/memory/conversation';
import { ChatRequest, Message, StreamChunk } from '@/lib/agent/types';

export const maxDuration = 120; // Allow up to 2 minutes for complex queries

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { conversationId, question, repoUrl, geminiApiKey, githubToken } = body;

    if (!conversationId || !question || !repoUrl || !geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: conversationId, question, repoUrl, geminiApiKey' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get or clone the repo
    let repo = getCachedRepo(repoUrl);
    if (!repo) {
      repo = await cloneRepo(repoUrl, githubToken);
    }

    // Get conversation state
    const convo = getConversation(conversationId, repoUrl);

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    addMessage(conversationId, userMessage);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (chunk: StreamChunk) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          );
        };

        try {
          // ── Step 1: Run the investigator ──
          const { answer, toolCalls } = await runInvestigator(
            question,
            repo,
            conversationId,
            geminiApiKey,
            githubToken,
            // onToolActivity callback
            (activity) => send({ type: 'tool_activity', data: activity }),
            // onContentDelta callback
            (delta) => send({ type: 'content_delta', data: delta }),
          );

          // Extract citations
          const citations = extractCitations(answer);
          send({ type: 'citations', data: citations });

          // Store the assistant message
          const assistantMessage: Message = {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            content: answer,
            citations,
            toolCalls,
            timestamp: Date.now(),
          };
          addMessage(conversationId, assistantMessage);

          // ── Step 2: Run the independent auditor ──
          send({ type: 'tool_activity', data: '🔍 Running independent audit...' });

          const audit = await runAuditor(
            question,
            answer,
            toolCalls,
            repo,
            conversationId,
            geminiApiKey,
            githubToken,
          );

          // Update the message with audit
          updateLastMessage(conversationId, { audit });
          send({ type: 'audit', data: audit });

          // ── Done ──
          send({ type: 'done', data: null });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'An error occurred';
          send({ type: 'error', data: errorMsg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
