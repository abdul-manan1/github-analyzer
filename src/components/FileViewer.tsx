import React, { useEffect, useState, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { X, Loader2 } from 'lucide-react';

interface FileViewerProps {
  repoUrl: string;
  filePath: string;
  startLine: number;
  endLine: number;
  githubToken?: string;
  onClose: () => void;
}

export function FileViewer({ repoUrl, filePath, startLine, endLine, githubToken, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl, filePath, githubToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setContent(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [repoUrl, filePath, githubToken]);

  // Determine language from extension
  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
      py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
      c: 'c', cpp: 'cpp', cs: 'csharp', html: 'html', css: 'css',
      json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml',
    };
    return ext ? map[ext] || 'text' : 'text';
  };

  // Highlight specific lines
  const lineProps = (lineNumber: number) => {
    const style: React.CSSProperties = { display: 'block' };
    if (startLine > 0 && lineNumber >= startLine && lineNumber <= (endLine || startLine)) {
      style.backgroundColor = 'rgba(59, 130, 246, 0.2)'; // Tailwind blue-500 with 20% opacity
      style.borderLeft = '3px solid #3b82f6';
      style.paddingLeft = '10px';
    } else {
      style.paddingLeft = '13px';
    }
    return { style };
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#222] w-full max-w-4xl max-h-[80vh] flex flex-col rounded shadow-2xl animate-fade-in relative z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#222] bg-black">
          <h3 className="font-mono text-sm text-gray-200 flex items-center gap-2">
            <span className="text-gray-500">File:</span> {filePath}
          </h3>
          <div className="flex items-center gap-3">
            {(startLine > 0 || endLine > 0) && (
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 bg-[#111] rounded border border-[#333] text-gray-400">
                Lines {startLine}-{endLine}
              </span>
            )}
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      
      <div className="flex-1 overflow-auto bg-[#1e1e1e]" ref={containerRef}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-500 gap-3">
            <Loader2 className="animate-spin" size={20} />
            <span className="text-xs uppercase tracking-widest">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 p-4 font-mono text-sm bg-[#1a0a0a] border border-red-900/50 m-4 rounded">
            {error}
          </div>
        ) : (
          <SyntaxHighlighter
            language={getLanguage(filePath)}
            style={vscDarkPlus as any}
            showLineNumbers
            wrapLines
            lineProps={lineProps}
            customStyle={{ margin: 0, padding: '1rem 0', background: 'transparent', fontSize: '0.85rem' }}
          >
            {content || ''}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
