import { useState, useRef, useEffect } from 'react';
import { Message, StreamChunk } from '@/lib/agent/types';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef(`convo_${Date.now()}`);

  const sendMessage = async (
    question: string,
    repoUrl: string,
    apiKey: string,
    githubToken?: string
  ) => {
    if (!question.trim() || !repoUrl || !apiKey) return;

    setError(null);
    setIsStreaming(true);

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const assistantMessageId = `msg_${Date.now()}_assistant`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        toolActivity: 'Starting investigation...',
      },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          question,
          repoUrl,
          geminiApiKey: apiKey,
          githubToken,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          
          buffer = lines.pop() || ''; // Keep the incomplete chunk in the buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              try {
                const chunk: StreamChunk = JSON.parse(dataStr);

                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== assistantMessageId) return msg;

                    switch (chunk.type) {
                      case 'content_delta':
                        return { ...msg, content: msg.content + chunk.data };
                      case 'tool_activity':
                        return { ...msg, toolActivity: chunk.data as string };
                      case 'citations':
                        return { ...msg, citations: chunk.data as any, toolActivity: undefined };
                      case 'audit':
                        return { ...msg, audit: chunk.data as any };
                      case 'done':
                        return { ...msg, isStreaming: false, toolActivity: undefined };
                      case 'error':
                        setError(chunk.data as string);
                        return { ...msg, isStreaming: false, toolActivity: undefined };
                      default:
                        return msg;
                    }
                  })
                );
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat error');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  return { messages, isStreaming, error, sendMessage };
}
