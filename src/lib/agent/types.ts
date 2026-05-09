// ──────────────────────────────────────────────────────────
// Codebase Investigator — Core Type Definitions
// ──────────────────────────────────────────────────────────

/** Represents a parsed GitHub repository URL */
export interface ParsedRepo {
  owner: string;
  repo: string;
  branch: string;
  fullUrl: string;
}

/** A single file in the repository */
export interface RepoFile {
  path: string;
  size: number;
  sha: string;
  content?: string;
}

/** Repository metadata and structure */
export interface RepoData {
  owner: string;
  repo: string;
  branch: string;
  description: string;
  language: string;
  stars: number;
  files: RepoFile[];
  tree: string[];  // flat list of all paths
  clonedAt: number;
}

/** Tool call made by the investigator */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: number;
}

/** A citation referencing a specific file and line range */
export interface Citation {
  file: string;
  startLine: number;
  endLine: number;
  content?: string;  // the actual content at those lines
  raw: string;       // the raw citation string, e.g., "[src/auth.ts:L42-L58]"
}

/** Result of verifying a single citation */
export interface CitationCheck {
  citation: Citation;
  fileExists: boolean;
  linesExist: boolean;
  contentMatches: boolean;
  actualContent?: string;
  verdict: 'verified' | 'partial' | 'invalid';
  reason?: string;
}

/** A tracked claim from an answer for contradiction detection */
export interface TrackedClaim {
  turnIndex: number;
  claim: string;
  context: string;
}

/** The audit report produced by the independent auditor */
export interface AuditReport {
  overallVerdict: 'trustworthy' | 'caution' | 'unreliable';
  citationVerification: {
    total: number;
    verified: number;
    partial: number;
    failed: number;
    details: CitationCheck[];
  };
  findings: {
    hallucinations: string[];
    overConfidence: string[];
    logicalGaps: string[];
    riskyAdvice: string[];
    contradictions: string[];
    missedContext: string[];
  };
  summary: string;
}

/** A single message in the conversation */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  toolCalls?: ToolCall[];
  audit?: AuditReport;
  timestamp: number;
  isStreaming?: boolean;
  toolActivity?: string;  // current tool activity label for UI
}

/** Conversation state stored server-side */
export interface ConversationState {
  id: string;
  repoUrl: string;
  messages: Message[];
  claims: TrackedClaim[];
  createdAt: number;
  lastActiveAt: number;
}

/** Request payload for the chat API */
export interface ChatRequest {
  conversationId: string;
  question: string;
  repoUrl: string;
  geminiApiKey: string;
  githubToken?: string;
}

/** Request payload for the repo API */
export interface RepoRequest {
  repoUrl: string;
  githubToken?: string;
}

/** Streamed chunk from the chat API */
export interface StreamChunk {
  type: 'tool_activity' | 'content_delta' | 'citations' | 'audit' | 'done' | 'error';
  data: string | Citation[] | AuditReport | null;
}
