// ──────────────────────────────────────────────────────────
// Conversation Memory — Multi-turn coherence + claim tracking
// ──────────────────────────────────────────────────────────

import { ConversationState, Message, TrackedClaim } from '../agent/types';

// In-memory store for conversations
const conversations = new Map<string, ConversationState>();

/**
 * Gets or creates a conversation
 */
export function getConversation(id: string, repoUrl: string): ConversationState {
  const existing = conversations.get(id);
  if (existing) {
    existing.lastActiveAt = Date.now();
    return existing;
  }

  const state: ConversationState = {
    id,
    repoUrl,
    messages: [],
    claims: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  conversations.set(id, state);
  return state;
}

/**
 * Adds a message to the conversation
 */
export function addMessage(conversationId: string, message: Message): void {
  const convo = conversations.get(conversationId);
  if (convo) {
    convo.messages.push(message);
    convo.lastActiveAt = Date.now();
  }
}

/**
 * Updates the last assistant message (for streaming)
 */
export function updateLastMessage(conversationId: string, updates: Partial<Message>): void {
  const convo = conversations.get(conversationId);
  if (convo && convo.messages.length > 0) {
    const last = convo.messages[convo.messages.length - 1];
    if (last.role === 'assistant') {
      Object.assign(last, updates);
    }
  }
}

/**
 * Adds tracked claims from an answer
 */
export function addClaims(conversationId: string, claims: TrackedClaim[]): void {
  const convo = conversations.get(conversationId);
  if (convo) {
    convo.claims.push(...claims);
  }
}

/**
 * Gets all previous claims for contradiction detection
 */
export function getPreviousClaims(conversationId: string): TrackedClaim[] {
  const convo = conversations.get(conversationId);
  return convo?.claims || [];
}

/**
 * Builds the conversation history for the Gemini API.
 * Formats messages into the Gemini chat format.
 */
export function buildChatHistory(conversationId: string): Array<{
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}> {
  const convo = conversations.get(conversationId);
  if (!convo) return [];

  return convo.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: msg.content }],
  }));
}

/**
 * Gets conversation context summary for the auditor
 */
export function getConversationSummary(conversationId: string): string {
  const convo = conversations.get(conversationId);
  if (!convo || convo.messages.length === 0) return 'This is the first question in the conversation.';

  const turns = convo.messages.map((msg, i) => {
    const role = msg.role === 'user' ? 'User' : 'Investigator';
    // Truncate long messages for the summary
    const content = msg.content.length > 500
      ? msg.content.slice(0, 500) + '...'
      : msg.content;
    return `Turn ${Math.floor(i / 2) + 1} (${role}): ${content}`;
  });

  return `Conversation history (${convo.messages.length} messages):\n${turns.join('\n\n')}`;
}

/**
 * Lists all conversation IDs
 */
export function listConversations(): string[] {
  return Array.from(conversations.keys());
}

/**
 * Deletes a conversation
 */
export function deleteConversation(id: string): void {
  conversations.delete(id);
}
