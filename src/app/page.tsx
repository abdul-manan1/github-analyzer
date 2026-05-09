'use client';

import React, { useState } from 'react';
import { RepoInput } from '@/components/RepoInput';
import { Sidebar } from '@/components/Sidebar';
import { ChatInterface } from '@/components/ChatInterface';
import { FileViewer } from '@/components/FileViewer';
import { useRepo } from '@/hooks/useRepo';

export default function Home() {
  const { repoData, isLoading, error, loadRepo } = useRepo();
  const [githubToken, setGithubToken] = useState<string | undefined>();
  
  // File viewer state
  const [activeFile, setActiveFile] = useState<{
    path: string;
    startLine: number;
    endLine: number;
  } | null>(null);

  const handleLoadRepo = async (url: string, token?: string) => {
    setGithubToken(token);
    await loadRepo(url, token);
  };

  const handleCitationClick = (file: string, startLine: number, endLine: number) => {
    setActiveFile({ path: file, startLine, endLine });
  };

  const handleSidebarFileClick = (path: string) => {
    setActiveFile({ path, startLine: 0, endLine: 0 });
  };

  // If repo is not loaded yet, show the input screen
  if (!repoData) {
    return (
      <main className="min-h-screen flex items-start justify-center p-4">
        <RepoInput 
          onLoad={handleLoadRepo} 
          isLoading={isLoading} 
          error={error} 
        />
      </main>
    );
  }

  // Once repo is loaded, show the main UI
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar with repo structure */}
      <Sidebar 
        repo={repoData} 
        onSelectFile={handleSidebarFileClick} 
      />

      {/* Main Chat Interface */}
      <ChatInterface 
        repo={repoData} 
        githubToken={githubToken}
        onCitationClick={handleCitationClick} 
      />

      {/* Floating File Viewer (shows up when a citation is clicked) */}
      {activeFile && (
        <FileViewer
          repoUrl={`https://github.com/${repoData.owner}/${repoData.repo}`}
          filePath={activeFile.path}
          startLine={activeFile.startLine}
          endLine={activeFile.endLine}
          githubToken={githubToken}
          onClose={() => setActiveFile(null)}
        />
      )}
    </div>
  );
}
