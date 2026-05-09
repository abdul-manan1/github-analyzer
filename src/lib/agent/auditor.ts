// ──────────────────────────────────────────────────────────
// Auditor Agent — Independent verification (separate context)
// ──────────────────────────────────────────────────────────

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuditReport, RepoData, ToolCall, CitationCheck } from './types';
import { AUDITOR_SYSTEM_PROMPT } from './prompts';
import { extractCitations, verifyCitations } from '../citations/verifier';
import { getConversationSummary, getPreviousClaims } from '../memory/conversation';

/**
 * Runs the independent auditor on an investigator's answer.
 * 
 * This is the KEY differentiator:
 * 1. Uses a SEPARATE model call with FRESH context (no conversation history)
 * 2. Includes PROGRAMMATIC citation verification results
 * 3. Checks for contradictions against tracked claims
 * 
 * The auditor NEVER self-scores — it reviews from the outside.
 */
export async function runAuditor(
  question: string,
  answer: string,
  toolCalls: ToolCall[],
  repo: RepoData,
  conversationId: string,
  apiKey: string,
  githubToken?: string,
): Promise<AuditReport> {
  // ── Step 1: Programmatic citation verification ──
  const citations = extractCitations(answer);
  const citationChecks = await verifyCitations(citations, repo, githubToken);

  const citationReport = buildCitationReport(citationChecks);

  // ── Step 2: Get conversation context for contradiction detection ──
  const conversationSummary = getConversationSummary(conversationId);
  const previousClaims = getPreviousClaims(conversationId);
  const claimsContext = previousClaims.length > 0
    ? `\nPrevious claims made in this conversation:\n${previousClaims.map(c => `  Turn ${c.turnIndex}: "${c.claim}"`).join('\n')}`
    : '\nNo previous claims to check against (first answer).';

  // ── Step 3: Build the auditor prompt (FRESH context, no history) ──
  const toolCallLog = toolCalls.map(tc =>
    `Tool: ${tc.name}\nArgs: ${JSON.stringify(tc.args)}\nResult (truncated): ${tc.result.slice(0, 1000)}${tc.result.length > 1000 ? '...' : ''}`
  ).join('\n\n---\n\n');

  const auditPrompt = `## Question
${question}

## Investigator's Answer
${answer}

## Tool Call Log (${toolCalls.length} calls made)
${toolCallLog || 'No tool calls were made.'}

## Programmatic Citation Verification Report
${citationReport}

## Conversation Context
${conversationSummary}
${claimsContext}

## Your Task
Evaluate the answer above. Return your assessment as a JSON object following the schema in your instructions.`;

  // ── Step 4: Call the auditor model (SEPARATE context) ──
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    systemInstruction: AUDITOR_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  try {
    // IMPORTANT: This is a one-shot call with NO conversation history
    // The auditor gets fresh context every time
    const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
      let retries = 4;
      let delay = 15000;
      while (true) {
        try {
          return await operation();
        } catch (err: any) {
          if (err.message?.includes('429') && retries > 0) {
            await new Promise(res => setTimeout(res, delay));
            delay += 10000;
            retries--;
          } else {
            throw err;
          }
        }
      }
    };

    const result = await withRetry(() => model.generateContent(auditPrompt));
    const text = result.response.text();

    // Parse the JSON response
    const auditData = JSON.parse(text);

    // Merge programmatic citation checks with AI audit
    const report: AuditReport = {
      overallVerdict: auditData.overallVerdict || 'caution',
      citationVerification: {
        total: citations.length,
        verified: citationChecks.filter(c => c.verdict === 'verified').length,
        partial: citationChecks.filter(c => c.verdict === 'partial').length,
        failed: citationChecks.filter(c => c.verdict === 'invalid').length,
        details: citationChecks,
      },
      findings: {
        hallucinations: auditData.findings?.hallucinations || [],
        overConfidence: auditData.findings?.overConfidence || [],
        logicalGaps: auditData.findings?.logicalGaps || [],
        riskyAdvice: auditData.findings?.riskyAdvice || [],
        contradictions: auditData.findings?.contradictions || [],
        missedContext: auditData.findings?.missedContext || [],
      },
      summary: auditData.summary || 'Audit completed.',
    };

    // Override verdict if programmatic checks found issues
    if (report.citationVerification.failed > 0 && report.overallVerdict === 'trustworthy') {
      report.overallVerdict = 'caution';
      report.summary += ` Note: ${report.citationVerification.failed} citation(s) could not be verified programmatically.`;
    }

    return report;
  } catch (err) {
    // If audit fails, return a minimal report
    return {
      overallVerdict: 'caution',
      citationVerification: {
        total: citations.length,
        verified: citationChecks.filter(c => c.verdict === 'verified').length,
        partial: citationChecks.filter(c => c.verdict === 'partial').length,
        failed: citationChecks.filter(c => c.verdict === 'invalid').length,
        details: citationChecks,
      },
      findings: {
        hallucinations: [],
        overConfidence: [],
        logicalGaps: [],
        riskyAdvice: [],
        contradictions: [],
        missedContext: [],
      },
      summary: `Audit partially completed. Citation verification done. AI review encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

/**
 * Builds a human-readable citation verification report for the auditor
 */
function buildCitationReport(checks: CitationCheck[]): string {
  if (checks.length === 0) {
    return 'No citations found in the answer to verify.';
  }

  const lines = checks.map(c => {
    const icon = c.verdict === 'verified' ? '✅' : c.verdict === 'partial' ? '⚠️' : '❌';
    let line = `${icon} ${c.citation.raw} — ${c.verdict.toUpperCase()}`;
    if (c.reason) line += ` (${c.reason})`;
    return line;
  });

  const verified = checks.filter(c => c.verdict === 'verified').length;
  const total = checks.length;

  return `Citation verification: ${verified}/${total} verified\n${lines.join('\n')}`;
}
