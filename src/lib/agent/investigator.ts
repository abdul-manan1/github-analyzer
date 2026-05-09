// ──────────────────────────────────────────────────────────
// Investigator Agent — Agentic loop with tool calling
// ──────────────────────────────────────────────────────────

import { GoogleGenerativeAI, FunctionCallingMode, FunctionDeclaration } from '@google/generative-ai';
import { RepoData, ToolCall, Message } from './types';
import { TOOL_DECLARATIONS, executeTool } from './tools';
import { INVESTIGATOR_SYSTEM_PROMPT, buildClaimExtractionPrompt } from './prompts';
import { buildChatHistory, addClaims } from '../memory/conversation';

const MAX_TOOL_CALLS = 12;

interface InvestigatorResult {
  answer: string;
  toolCalls: ToolCall[];
}

/**
 * Runs the investigator agent loop.
 * Uses Gemini function calling to investigate the codebase and produce grounded answers.
 */
export async function runInvestigator(
  question: string,
  repo: RepoData,
  conversationId: string,
  apiKey: string,
  githubToken?: string,
  onToolActivity?: (activity: string) => void,
  onContentDelta?: (delta: string) => void,
): Promise<InvestigatorResult> {
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    systemInstruction: INVESTIGATOR_SYSTEM_PROMPT,
    tools: [{
      functionDeclarations: TOOL_DECLARATIONS as unknown as FunctionDeclaration[],
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.AUTO,
      },
    },
  });

  // Build chat with history
  const history = buildChatHistory(conversationId);

  // Add repo context to the first message
  const repoContext = `[Repository: ${repo.owner}/${repo.repo} | Language: ${repo.language} | ${repo.files.length} files | ${repo.description || 'No description'}]\n\n`;

  const chat = model.startChat({
    history: history.length > 0 ? history : undefined,
  });

  const toolCalls: ToolCall[] = [];
  let answer = '';

  // Send the user's question with repo context
  const fullQuestion = history.length === 0
    ? `${repoContext}${question}`
    : question;

  const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
    let retries = 4;
    let delay = 15000;
    while (true) {
      try {
        return await operation();
      } catch (err: any) {
        if (err.message?.includes('429') && retries > 0) {
          if (onToolActivity) onToolActivity(`⏳ Rate limit reached. Waiting ${delay/1000}s to retry...`);
          await new Promise(res => setTimeout(res, delay));
          delay += 10000;
          retries--;
        } else {
          throw err;
        }
      }
    }
  };

  let response = await withRetry(() => chat.sendMessage(fullQuestion));
  let iterations = 0;

  // Agentic loop: keep processing until model produces text (not tool calls)
  while (iterations < MAX_TOOL_CALLS) {
    const candidate = response.response.candidates?.[0];
    if (!candidate?.content?.parts) break;

    const parts = candidate.content.parts;

    // Check for function calls
    const functionCalls = parts.filter(p => p.functionCall);

    if (functionCalls.length === 0) {
      // Model produced text — we're done
      const textParts = parts.filter(p => p.text);
      answer = textParts.map(p => p.text).join('');
      if (onContentDelta && answer) {
        onContentDelta(answer);
      }
      break;
    }

    // Execute all function calls
    const toolResults: any[] = [];
    for (const part of functionCalls) {
      const fc = part.functionCall!;
      const toolName = fc.name;
      const args = fc.args as Record<string, unknown>;

      // Notify UI about tool activity
      const activityLabels: Record<string, string> = {
        'list_structure': `📂 Exploring repository structure${args.path_prefix ? ` under ${args.path_prefix}` : ''}...`,
        'read_file': `📖 Reading ${args.path || 'file'}...`,
        'search_files': `🔍 Searching for "${args.query}"...`,
        'grep_code': `🔎 Searching for pattern "${args.pattern}"...`,
      };
      if (onToolActivity) {
        onToolActivity(activityLabels[toolName] || `⚙️ Running ${toolName}...`);
      }

      const toolCall = await executeTool(toolName, args, repo, githubToken);
      toolCalls.push(toolCall);

      toolResults.push({
        functionResponse: {
          name: toolName,
          response: { result: toolCall.result },
        },
      });
    }

    // Send tool results back to the model
    response = await withRetry(() => chat.sendMessage(toolResults));
    iterations++;
  }

  // Extract claims for contradiction tracking (do this asynchronously)
  extractAndStoreClaims(answer, conversationId, apiKey).catch(() => {
    // Non-critical — if claim extraction fails, we continue
  });

  return { answer, toolCalls };
}

/**
 * Extracts factual claims from an answer and stores them for contradiction detection
 */
async function extractAndStoreClaims(
  answer: string,
  conversationId: string,
  apiKey: string,
): Promise<void> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const result = await model.generateContent(buildClaimExtractionPrompt(answer));
    const text = result.response.text();

    // Parse the JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const claims: string[] = JSON.parse(jsonMatch[0]);
      const conversations = await import('../memory/conversation');
      const convo = conversations.getConversation(conversationId, '');
      const turnIndex = Math.floor(convo.messages.length / 2);

      addClaims(
        conversationId,
        claims.map(claim => ({
          turnIndex,
          claim,
          context: answer.slice(0, 200),
        }))
      );
    }
  } catch {
    // Silently fail — claim extraction is best-effort
  }
}
