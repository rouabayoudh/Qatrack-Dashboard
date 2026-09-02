// apps/web/components/dashboard/TopBar.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import type { Project } from '@qatrack/shared-types';

export function TopBar({
  projects,
  selectedProjectKey,
  onProjectChange,
  onSync,
  syncing,
  lastSynced,
}: {
  projects: Project[];
  selectedProjectKey: string;
  onProjectChange: (key: string) => void;
  onSync: () => void;
  syncing: boolean;
  lastSynced: string;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find((p) => p.key === selectedProjectKey);
  const displayLabel = selectedProject?.name ?? (projects.length === 0 ? 'No projects synced' : 'Select a project');

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 w-full sticky top-0 z-50 bg-white border-b border-outline-variant shadow-sm flex justify-between items-center px-gutter gap-4">
      <div className="flex items-center gap-4 flex-1">
        {/* Project picker dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => projects.length > 0 && setDropdownOpen((o) => !o)}
            disabled={projects.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Project:</span>
            <span className="text-body-sm font-semibold max-w-[180px] truncate text-on-surface">{displayLabel}</span>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
              {dropdownOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {dropdownOpen && projects.length > 0 && (
            <ul className="absolute left-0 top-full mt-1 w-64 bg-white border border-outline-variant rounded-lg shadow-xl z-50 py-1 overflow-hidden">
              {projects.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onProjectChange(p.key);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left flex items-center gap-2 px-4 py-2 text-body-sm hover:bg-surface-container transition-colors cursor-pointer ${
                      p.key === selectedProjectKey
                        ? 'bg-primary-container text-on-primary-container font-semibold'
                        : 'text-on-surface'
                    }`}
                  >
                    <span className="text-label-sm font-bold text-primary uppercase shrink-0">
                      {p.key}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.key === selectedProjectKey && (
                      <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-body-xs text-on-surface-variant text-[11px] hidden sm:inline">
          Last synced: <span className="font-semibold text-on-surface">{lastSynced}</span>
        </span>
        <button
          onClick={onSync}
          disabled={syncing || (!selectedProjectKey && projects.length === 0)}
          className="px-4 py-1.5 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed h-[34px] cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>
            sync
          </span>
          {syncing ? 'Syncing…' : 'Sync with Jira'}
        </button>

        <div className="h-6 w-[1px] bg-outline-variant mx-1"></div>

        <div className="relative flex items-center gap-1" ref={notifRef}>
          {/* Notifications */}
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            title="Notifications"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer relative"
          >
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-secondary rounded-full" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                <span className="font-semibold text-sm text-on-surface">Jira Live Status</span>
                <span className="text-[10px] bg-secondary-container/40 text-on-secondary-container px-2 py-0.5 rounded font-bold">
                  Connected
                </span>
              </div>
              <div className="space-y-2 text-body-sm text-on-surface-variant">
                <div className="p-2 rounded bg-surface-container-low">
                  <p className="font-semibold text-xs text-on-surface">Last Synchronized</p>
                  <p className="text-[11px] mt-0.5">{lastSynced !== 'Never' ? `Today at ${lastSynced}` : 'No sync recorded yet'}</p>
                </div>
                <div className="p-2 rounded bg-surface-container-low">
                  <p className="font-semibold text-xs text-on-surface">Active Jira Project</p>
                  <p className="text-[11px] mt-0.5">{selectedProject ? `${selectedProject.name} (${selectedProject.key})` : 'Select a project to sync'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            title="Dashboard Settings"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>

          {/* Help button */}
          <button
            onClick={() => setHelpOpen(true)}
            title="Help & Info"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined">help_outline</span>
          </button>

          {helpOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-outline-variant">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-on-surface">QATrack Dashboard Guide</h3>
                  <button
                    onClick={() => setHelpOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="text-body-sm space-y-2 text-on-surface-variant">
                  <p>
                    <strong className="text-on-surface">Project Switcher:</strong> Switch between your synced Jira projects to view scoped metrics and defects.
                  </p>
                  <p>
                    <strong className="text-on-surface">Sync with Jira:</strong> Fetches live issues, user stories, defects, and execution status directly from your Jira workspace.
                  </p>
                  <p>
                    <strong className="text-on-surface">Edit Widgets:</strong> Customize which metrics and charts are visible on your dashboard.
                  </p>
                </div>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="w-full py-2 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all cursor-pointer"
                >
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
