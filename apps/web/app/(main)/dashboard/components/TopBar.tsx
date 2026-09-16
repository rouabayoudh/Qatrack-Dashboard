'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@qatrack/shared-types';
import { fetchJiraStatus, fetchProjects, syncJiraIssues, type JiraConnectionStatus } from '@/lib/api';

export function TopBar({
  projects: propProjects,
  selectedProjectKey: propSelectedProjectKey,
  onProjectChange,
  onSync,
  syncing: propSyncing,
  lastSynced: propLastSynced,
  title,
}: {
  projects?: Project[];
  selectedProjectKey?: string;
  onProjectChange?: (key: string) => void;
  onSync?: () => void;
  syncing?: boolean;
  lastSynced?: string;
  title?: string;
}) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>(propProjects || []);
  const [selectedKey, setSelectedKey] = useState<string>(propSelectedProjectKey || '');
  const [syncing, setSyncing] = useState<boolean>(propSyncing || false);
  const [lastSynced, setLastSynced] = useState<string>(propLastSynced || '5 mins ago');
  const [jiraStatus, setJiraStatus] = useState<JiraConnectionStatus>({ connected: false });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Sync external props with internal state
  useEffect(() => {
    if (propProjects) setProjects(propProjects);
  }, [propProjects]);

  useEffect(() => {
    if (propSelectedProjectKey !== undefined) setSelectedKey(propSelectedProjectKey);
  }, [propSelectedProjectKey]);

  useEffect(() => {
    if (propSyncing !== undefined) setSyncing(propSyncing);
  }, [propSyncing]);

  useEffect(() => {
    if (propLastSynced) setLastSynced(propLastSynced);
  }, [propLastSynced]);

  // Load fallback Jira status & projects if not provided by parent
  useEffect(() => {
    if (!propProjects || propProjects.length === 0) {
      fetchProjects()
        .then((data) => {
          setProjects(data);
          if (data.length > 0 && !selectedKey) {
            setSelectedKey(data[0].key);
          }
        })
        .catch(() => {});
    }

    fetchJiraStatus()
      .then((status) => {
        setJiraStatus(status);
        if (status.lastSyncedAt && !propLastSynced) {
          setLastSynced(
            new Date(status.lastSyncedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          );
        }
      })
      .catch(() => {});
  }, [propProjects, propLastSynced, selectedKey]);

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

  const handleProjectSelect = (key: string) => {
    setSelectedKey(key);
    if (onProjectChange) onProjectChange(key);
    setDropdownOpen(false);
  };

  const handleSyncTrigger = async () => {
    if (onSync) {
      onSync();
      return;
    }
    setSyncing(true);
    try {
      const targetKey = selectedKey || projects[0]?.key || 'QAT';
      await syncJiraIssues(targetKey);
      const status = await fetchJiraStatus();
      setJiraStatus(status);
      setLastSynced('Just now');
    } catch (err: any) {
      console.error('TopBar sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const selectedProject = projects.find((p) => p.key === selectedKey);
  const displayLabel = selectedProject?.name ?? (projects.length === 0 ? 'QATrack Core' : 'QATrack Core');

  return (
    <header className="h-14 w-full sticky top-0 z-50 bg-white border-b border-outline-variant shadow-sm flex justify-between items-center px-6 gap-4">
      <div className="flex items-center gap-4">
        {title ? (
          <h2 className="text-base font-bold text-on-surface tracking-tight">{title}</h2>
        ) : (
          /* Project picker dropdown */
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => projects.length > 0 && setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-wider">PROJECT:</span>
              <span className="text-body-sm font-semibold text-on-surface-variant">{displayLabel}</span>
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
            </button>

            {dropdownOpen && projects.length > 0 && (
              <ul className="absolute left-0 top-full mt-1 w-64 bg-white border border-outline-variant rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                {projects.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => handleProjectSelect(p.key)}
                      className={`w-full text-left flex items-center gap-2 px-4 py-2 text-body-sm hover:bg-surface-container transition-colors cursor-pointer ${
                        p.key === selectedKey
                          ? 'bg-primary-container text-on-primary-container font-semibold'
                          : 'text-on-surface'
                      }`}
                    >
                      <span className="text-label-sm font-bold text-primary uppercase shrink-0">
                        {p.key}
                      </span>
                      <span className="truncate">{p.name}</span>
                      {p.key === selectedKey && (
                        <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-on-surface-variant hidden sm:inline">
            Last synced: <span className="font-bold text-on-surface">{lastSynced}</span>
          </span>
          <button
            onClick={handleSyncTrigger}
            disabled={syncing}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-primary text-primary rounded-lg font-semibold text-body-sm hover:bg-primary/5 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            {syncing ? 'Syncing…' : 'Sync with Jira'}
          </button>
        </div>

        <div className="w-px h-6 bg-outline-variant mx-1"></div>

        <div className="flex items-center gap-1 relative" ref={notifRef}>
          {/* Notifications Button */}
          <button
            onClick={() => setNotifOpen((prev) => !prev)}
            title="System Notifications"
            className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95 relative rounded-lg hover:bg-gray-100"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>
          </button>

          {/* Notifications Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-outline-variant pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-primary">notifications</span>
                  <span className="font-bold text-sm text-on-surface">Notifications</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  jiraStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {jiraStatus.connected ? 'Jira Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="space-y-2 text-body-sm text-on-surface-variant max-h-64 overflow-y-auto">
                <div className="p-2.5 rounded-lg bg-surface-container-low border border-gray-100 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                    <span>Jira Issue Sync</span>
                    <span className="text-[10px] text-gray-400">Live</span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {lastSynced !== 'Never' ? `Last synchronized today at ${lastSynced}` : 'No sync recorded yet'}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-container-low border border-gray-100 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                    <span>Active Project</span>
                    <span className="text-[10px] text-gray-400">Selected</span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    {selectedProject ? `${selectedProject.name} (${selectedProject.key})` : 'QATrack Core'}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-surface-container-low border border-gray-100 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-on-surface">
                    <span>Integrations & Webhooks</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Active</span>
                  </div>
                  <p className="text-[11px] text-gray-600">CI/CD incoming webhooks configured and listening.</p>
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant flex justify-end">
                <button
                  onClick={() => {
                    setNotifOpen(false);
                    router.push('/settings');
                  }}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Manage Settings & Audit Logs ↗
                </button>
              </div>
            </div>
          )}

          {/* Settings / Params Button */}
          <button
            onClick={() => router.push('/settings')}
            title="Admin Settings & Parameters"
            className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95 rounded-lg hover:bg-gray-100"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>

          {/* Help & Info Button */}
          <button
            onClick={() => setHelpOpen(true)}
            title="Help & System Guide"
            className="p-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer active:scale-95 rounded-lg hover:bg-gray-100"
          >
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>

          {/* Help Modal */}
          {helpOpen && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-outline-variant">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[24px]">info</span>
                    <h3 className="font-bold text-lg text-on-surface">QATrack Platform Guide</h3>
                  </div>
                  <button
                    onClick={() => setHelpOpen(false)}
                    className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer rounded-lg hover:bg-gray-100"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="text-xs space-y-3 text-on-surface-variant leading-relaxed">
                  <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <strong className="text-primary block font-bold mb-1">Project Switcher & Sync:</strong>
                    Switch between your synced Jira projects or trigger a real-time sync with Atlassian Cloud / Server.
                  </div>
                  <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
                    <strong className="text-purple-900 block font-bold mb-1">Params & Settings:</strong>
                    Click the gear icon to manage Webhooks, Team Roles, Audit Logs, and Integrations in Admin Settings.
                  </div>
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <strong className="text-emerald-900 block font-bold mb-1">Live Notifications:</strong>
                    Click the bell icon to monitor real-time sync events, active webhooks, and account connections.
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setHelpOpen(false);
                      router.push('/settings');
                    }}
                    className="px-4 py-2 border border-outline-variant text-gray-700 rounded-lg font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                  >
                    Open Settings
                  </button>
                  <button
                    onClick={() => setHelpOpen(false)}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-semibold text-xs hover:bg-primary/90 cursor-pointer"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
