import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { UserGitHubRepo } from '../types';
import { X, FolderGit2, Search, Check, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

interface TrackRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TrackRepoModal: React.FC<TrackRepoModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [repos, setRepos] = useState<UserGitHubRepo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoWebhook, setAutoWebhook] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUserRepos();
    }
  }, [isOpen]);

  const loadUserRepos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUserGitHubRepos();
      setRepos(data);
    } catch (e: any) {
      console.warn('Could not load user GitHub repos:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleTrack = async (repoName: string) => {
    const trimmed = repoName.trim();
    if (!trimmed || !trimmed.includes('/')) {
      setError('Repository name must be in format "owner/repo" (e.g. facebook/react)');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.trackRepository({
        full_name: trimmed,
        auto_install_webhook: autoWebhook,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to track repository.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-0/80 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-2 border border-border-prominent w-full max-w-xl rounded-2xl shadow-card-hover overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-1/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Track a Repository</h3>
              <p className="text-xs text-slate-400">Enable automated AST rule checking & Groq AI reviews.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-surface-3 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Manual Entry */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Enter GitHub Repository Name (owner/repo)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. vercel/next.js"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTrack(manualInput);
                }}
                className="flex-1 bg-surface-0 border border-border-subtle focus:border-brand-400 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none transition-colors"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTrack(manualInput)}
                disabled={submitting || !manualInput.trim()}
                loading={submitting}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Track
              </Button>
            </div>
          </div>

          {/* Auto Webhook Checkbox */}
          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="autoWebhook"
              checked={autoWebhook}
              onChange={(e) => setAutoWebhook(e.target.checked)}
              className="rounded bg-surface-0 border-border-subtle text-brand-500 focus:ring-brand-400 h-4 w-4"
            />
            <label htmlFor="autoWebhook" className="text-xs text-slate-300 select-none">
              Automatically install webhook on GitHub via API (requires repo admin token)
            </label>
          </div>

          {/* User GitHub Repos Catalog */}
          <div className="pt-3 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300">
                Or choose from your GitHub repositories
              </span>
              {loading && <RefreshCw className="w-3.5 h-3.5 text-brand-400 animate-spin" />}
            </div>

            {repos.length > 0 && (
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter your repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-surface-0 border border-border-subtle focus:border-brand-400 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {loading && repos.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Loading your GitHub repositories...
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-surface-0/50 rounded-xl border border-border-subtle">
                  No repositories found. Ensure you are signed in with GitHub or enter the repo name manually above.
                </div>
              ) : (
                filteredRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-surface-0 hover:bg-surface-3/70 border border-border-subtle transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                          {repo.full_name}
                        </span>
                        {repo.private && (
                          <span className="text-[10px] bg-surface-2 text-slate-400 px-1.5 py-0.2 rounded border border-border-subtle">
                            Private
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {repo.description}
                        </p>
                      )}
                    </div>

                    {repo.is_tracked ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md flex-shrink-0">
                        <Check className="w-3 h-3" />
                        Tracked
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => handleTrack(repo.full_name)}
                        disabled={submitting}
                        icon={<Plus className="w-3 h-3" />}
                      >
                        Track
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-1/50 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
