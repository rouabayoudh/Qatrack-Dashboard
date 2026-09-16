'use client';

import { useState } from 'react';
import { connectJiraBasic } from '@/lib/api';

interface ConnectJiraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConnectJiraModal({ isOpen, onClose, onSuccess }: ConnectJiraModalProps) {
  const [jiraDomain, setJiraDomain] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !apiToken) {
      setError('Please provide your Jira email and API Token.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await connectJiraBasic({
        email,
        apiToken,
        jiraDomain: jiraDomain.trim() || undefined,
      });
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to connect to Jira');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant w-full max-w-md overflow-hidden flex flex-col my-8">
        <div className="p-6 pb-4 border-b border-outline-variant flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">sync</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface leading-snug">Connect Real Jira Account</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Fetch live requirements, user stories, epics, and defects directly from your Jira Cloud instance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-error-container text-on-error-container border border-error/30 rounded-lg text-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-label-sm font-semibold text-on-surface mb-1">
              Jira Domain <span className="text-on-surface-variant font-normal">(e.g. company.atlassian.net)</span>
            </label>
            <input
              type="text"
              placeholder="company.atlassian.net"
              value={jiraDomain}
              onChange={(e) => setJiraDomain(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-label-sm font-semibold text-on-surface mb-1">
              Jira Email <span className="text-error">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-label-sm font-semibold text-on-surface">
                Jira API Token <span className="text-error">*</span>
              </label>
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-label-sm text-primary hover:underline font-medium"
              >
                Generate API Token ↗
              </a>
            </div>
            <input
              type="password"
              required
              placeholder="Paste your Atlassian API Token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-outline-variant mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-outline-variant bg-white text-on-surface rounded-lg font-semibold text-body-sm hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary text-white rounded-lg font-semibold text-body-sm hover:bg-primary-container shadow-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
              {loading ? 'Connecting & Syncing…' : 'Connect & Sync Real Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
