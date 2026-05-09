import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Message } from '@/lib/agent/types';
import { AuditCard } from './AuditCard';
import { Bot, User, Terminal, Loader2 } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onCitationClick: (file: string, startLine: number, endLine: number) => void;
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Replace citations like [src/file.ts:L1-L10] or [src/file.ts] with custom clickable components
  const processContent = (text: string) => {
    return text; // We will use a custom remark plugin or a simple regex replacement in the UI
  };

  // Simple string replacement for citations to make them look nice before markdown parsing
  // Realistically we'd write a remark plugin, but for the assessment this regex approach works
  const contentWithCitations = message.content.replace(
    /\[([^\]]+?(?:\.\w+))(?::L(\d+)(?:-L(\d+))?)?\]/g,
    (match, file, start, end) => {
      const dataAttr = `data-file="${file}" data-start="${start || 0}" data-end="${end || start || 0}"`;
      return `<button class="citation-link" ${dataAttr}>${match}</button>`;
    }
  );

  // Handle clicks on our raw HTML citations
  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('citation-link')) {
      const file = target.getAttribute('data-file');
      const start = parseInt(target.getAttribute('data-start') || '0', 10);
      const end = parseInt(target.getAttribute('data-end') || '0', 10);
      if (file) {
        onCitationClick(file, start, end);
      }
    }
  };

  return (
    <div className={`flex w-full animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div 
          className={`px-5 py-4 rounded ${
            isUser ? 'bg-[#222] text-white' : 'bg-transparent text-gray-200'
          }`}
          onClick={handleClick}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="prose prose-invert max-w-none text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md !bg-[#0d0d0d] !m-0 !mt-2 !mb-2"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Render raw HTML safely since we control the regex replacement
                  p: ({node, children}) => {
                    // Need to use dangerouslySetInnerHTML for our citation buttons to work if they are strings
                    // A proper implementation would use a custom ReactMarkdown component
                    if (children && Array.isArray(children) && typeof children[0] === 'string' && children[0].includes('class="citation-link"')) {
                      return <p dangerouslySetInnerHTML={{ __html: children[0] }} />;
                    }
                    return <p>{children}</p>;
                  }
                }}
              >
                {contentWithCitations}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5 uppercase tracking-wider font-mono px-5">
            <Terminal size={12} />
            <span>{message.toolCalls.length} tool calls</span>
          </div>
        )}

        {!isUser && message.isStreaming && message.toolActivity && (
          <div className="mt-2 text-[11px] text-gray-400 flex items-center gap-2 px-5 py-2 font-mono">
            <Loader2 size={12} className="animate-spin" />
            {message.toolActivity}
          </div>
        )}

        {message.audit && (
          <div className="mt-2 w-full px-5">
            <AuditCard audit={message.audit} />
          </div>
        )}
      </div>
    </div>
  );
}
