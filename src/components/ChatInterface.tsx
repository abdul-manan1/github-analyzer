'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RepoData } from '@/lib/agent/types';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { Send, KeyRound } from 'lucide-react';

interface ChatInterfaceProps {
  repo: RepoData;
  githubToken?: string;
  onCitationClick: (file: string, startLine: number, endLine: number) => void;
}

export function ChatInterface({ repo, githubToken, onCitationClick }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyPrompt, setShowApiKeyPrompt] = useState(false);
  const { messages, isStreaming, error, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const repoUrl = `https://github.com/${repo.owner}/${repo.repo}`;

  // Load API key from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setApiKey(saved);
    else setShowApiKeyPrompt(true);
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowApiKeyPrompt(false);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    
    if (!apiKey) {
      setShowApiKeyPrompt(true);
      return;
    }

    const question = input;
    setInput('');
    await sendMessage(question, repoUrl, apiKey, githubToken);
  };

  return (
    <div className="flex-1 flex flex-col h-screen relative">
      {/* Header */}
      <header className="h-16 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="font-semibold text-sm flex items-center gap-2 text-white">
          Investigation Session
        </h1>
        <button 
          onClick={() => setShowApiKeyPrompt(true)}
          className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
            apiKey ? 'border-[#333] text-gray-300 hover:bg-[#111]' : 'border-white text-black bg-white hover:bg-gray-200'
          }`}
        >
          <KeyRound size={12} />
          {apiKey ? 'API Key Set' : 'API Key Required'}
        </button>
      </header>

      {/* API Key Modal Overlay */}
      {showApiKeyPrompt && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] p-8 rounded border border-[#333] max-w-md w-full animate-fade-in shadow-2xl">
            <h2 className="text-lg font-semibold mb-2 text-white">Set API Key</h2>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Codebase Investigator requires a Google Gemini API key to function. 
              The key is only stored locally in your browser.
            </p>
            <input 
              type="password"
              placeholder="AIzaSy..."
              className="input mb-5 text-sm font-mono"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey(apiKey)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              {localStorage.getItem('gemini_api_key') && (
                <button 
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  onClick={() => setShowApiKeyPrompt(false)}
                >
                  Cancel
                </button>
              )}
              <button 
                className="btn"
                onClick={() => saveApiKey(apiKey)}
                disabled={!apiKey}
              >
                Save & Continue
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500">
              Get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-10">
            <h3 className="text-lg font-semibold mb-2 text-white">Repository Loaded</h3>
            <p className="text-sm text-gray-500 mb-8">
              Ask questions about the architecture, auth flow, potential bugs, or let the investigator summarize the codebase.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {[
                "How does authentication work here?",
                "Walk me through the main user flow.",
                "Are there any security risks in the codebase?",
                "What's the best way to add a new API route?"
              ].map(q => (
                <button 
                  key={q}
                  className="text-xs bg-[#111] hover:bg-[#222] border border-[#333] rounded px-4 py-3 transition-colors text-left text-gray-300"
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              onCitationClick={onCitationClick} 
            />
          ))
        )}
        
        {error && (
          <div className="mx-auto w-full max-w-3xl bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-black via-black to-transparent pt-8">
        <form 
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto relative flex items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask about the codebase..."
            className="w-full bg-[#111] border border-[#333] rounded-lg py-4 pl-4 pr-14 text-white resize-none focus:outline-none focus:border-[#666] min-h-[60px] max-h-[200px] text-sm"
            rows={Math.min(5, input.split('\n').length || 1)}
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="absolute right-2 bottom-2 p-2 bg-white hover:bg-gray-200 text-black rounded disabled:opacity-50 disabled:bg-[#333] disabled:text-gray-500 transition-colors"
          >
            <Send size={16} />
          </button>
        </form>
        <div className="text-center mt-3 text-[10px] text-gray-500 uppercase tracking-widest">
          Gemini 3.0 Flash · Independent Audit Pipeline
        </div>
      </div>
    </div>
  );
}
