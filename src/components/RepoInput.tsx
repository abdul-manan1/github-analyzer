import React, { useState } from 'react';
import { GitBranch, Key, Loader2, ArrowRight } from 'lucide-react';

interface RepoInputProps {
  onLoad: (url: string, githubToken?: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function RepoInput({ onLoad, isLoading, error }: RepoInputProps) {
  const [url, setUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      onLoad(url, token || undefined);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto flex-col p-8 bg-[#0a0a0a] border border-[#222] rounded-lg mt-[20vh] animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-2 text-white">Codebase Investigator</h1>
        <p className="text-gray-400 text-sm">
          Provide a public GitHub URL to begin the investigation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex gap-2 relative">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="input w-full p-3 pl-10 text-sm font-mono bg-black"
            required
            disabled={isLoading}
          />
          <GitBranch size={16} className="absolute left-3 top-3.5 text-gray-500" />
          
          <button type="submit" className="btn px-5" disabled={isLoading || !url}>
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 p-3 rounded">
            {error}
          </div>
        )}

        <div>
          <button
            type="button"
            className="text-xs text-gray-500 flex items-center gap-1.5 hover:text-gray-300 transition-colors"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Key size={12} /> {showSettings ? 'Hide access token' : 'Use private access token'}
          </button>
          
          {showSettings && (
            <div className="mt-3 p-4 bg-[#111] rounded border border-[#222] animate-fade-in">
              <label className="block text-xs text-gray-400 mb-2">
                GitHub Personal Access Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="input text-sm font-mono bg-black"
              />
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
