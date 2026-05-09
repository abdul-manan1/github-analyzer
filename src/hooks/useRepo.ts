import { useState } from 'react';
import { RepoData } from '@/lib/agent/types';

export function useRepo() {
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepo = async (url: string, githubToken?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url, githubToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load repository');
      }

      setRepoData(data.data);
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { repoData, isLoading, error, loadRepo, setRepoData };
}
