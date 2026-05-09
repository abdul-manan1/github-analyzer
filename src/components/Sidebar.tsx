import React from 'react';
import { RepoData } from '@/lib/agent/types';
import { FolderGit2, Star, FileCode2, Info } from 'lucide-react';

interface SidebarProps {
  repo: RepoData;
  onSelectFile?: (path: string) => void;
}

export function Sidebar({ repo, onSelectFile }: SidebarProps) {
  // Build a simple tree view
  const renderTree = () => {
    // A real app would build a nested tree, but for brevity we'll just show the top 50 files
    const limit = 50;
    const files = repo.tree.slice(0, limit);
    const hasMore = repo.tree.length > limit;

    return (
      <div className="mt-4 text-sm font-mono flex-col gap-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
        {files.map((path) => {
          const parts = path.split('/');
          const name = parts.pop();
          const indent = parts.length * 12;
          
          return (
            <div 
              key={path}
              className="py-1.5 px-2 hover:bg-[#111] rounded cursor-pointer truncate text-gray-400 hover:text-white transition-colors"
              style={{ paddingLeft: `${indent + 8}px` }}
              onClick={() => onSelectFile?.(path)}
              title={path}
            >
              <span className="text-gray-500 mr-2">{parts.length === 0 ? '📄' : '📁'}</span>
              {name}
            </div>
          );
        })}
        {hasMore && (
          <div className="py-2 px-2 text-xs text-gray-500 italic">
            ...and {repo.tree.length - limit} more files
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 h-screen border-r border-[#222] bg-[#0a0a0a] p-4 flex flex-col flex-shrink-0">
      <div className="mb-6">
        <h2 className="font-semibold text-sm mb-1 flex items-center gap-2 text-white">
          <FolderGit2 className="text-gray-400" size={16} />
          {repo.repo}
        </h2>
        <p className="text-[10px] text-gray-500 mb-5 font-mono uppercase tracking-widest">{repo.owner}</p>
        
        <div className="flex flex-col gap-3 text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-gray-500" />
            <span>{repo.stars.toLocaleString()} stars</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCode2 size={14} className="text-gray-500" />
            <span>{repo.language}</span>
          </div>
          <div className="flex items-center gap-2">
            <Info size={14} className="text-gray-500" />
            <span>{repo.files.length} indexed files</span>
          </div>
        </div>
      </div>
      
      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 pb-2 border-b border-[#222]">
        Repository Structure
      </div>
      {renderTree()}
    </div>
  );
}
