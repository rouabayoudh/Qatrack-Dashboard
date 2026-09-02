'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchApi,
  fetchCurrentUser,
  fetchRequirements,
  fetchTestSuites,
  createTestCaseFull,
  type CurrentUser,
} from '@/lib/api';
import type {
  Requirement,
  RequirementType,
  JiraConnectionStatus,
  Project,
  TestSuite,
  TestCasePriority,
  TestCaseType,
} from '@qatrack/shared-types';
import { Sidebar } from '../dashboard/components/Sidebar';

// ── Type icon helpers ──────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: RequirementType }) {
  switch (type) {
    case 'EPIC':
      return <span className="material-symbols-outlined text-tertiary text-sm" title="Epic">bookmark</span>;
    case 'BUG':
      return <span className="material-symbols-outlined text-error text-sm" title="Bug">bug_report</span>;
    case 'TASK':
      return <span className="material-symbols-outlined text-secondary text-sm" title="Task">check_circle</span>;
    default:
      return <span className="material-symbols-outlined text-primary text-sm" title="Story">description</span>;
  }
}

function CoverageChip({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? '';
  const done = s === 'done' || s === 'closed' || s === 'resolved';
  if (done)
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-container/30 text-[11px] font-bold text-on-secondary-container">
        <span className="w-1 h-1 rounded-full bg-secondary mr-1.5" />
        Covered
      </span>
    );
  if (s === 'in progress')
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
        <span className="w-1 h-1 rounded-full bg-amber-500 mr-1.5" />
        Partial
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-error-container text-[11px] font-bold text-on-error-container">
      <span className="w-1 h-1 rounded-full bg-error mr-1.5" />
      Uncovered
    </span>
  );
}

// ── Priority helpers ──────────────────────────────────────────────────────────

function getPriorityIndicator() {
  return {
    className: 'priority-high',
    label: 'P1 - High',
  };
}

// ── Detail Pane Component ─────────────────────────────────────────────────────

function DetailPane({
  req,
  jiraStatus,
  onClose,
  onCreateTestCase,
}: {
  req: Requirement | null;
  jiraStatus: JiraConnectionStatus;
  onClose: () => void;
  onCreateTestCase: (req: Requirement) => void;
}) {
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (paneRef.current && !paneRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (req) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [req, onClose]);

  return (
    <div
      ref={paneRef}
      className={`fixed top-0 right-0 w-[400px] h-full bg-white shadow-2xl z-50 flex flex-col border-l border-outline-variant transition-transform duration-300 ${
        req ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {req && (
        <>
          {/* Header */}
          <div className="p-6 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
            <div className="flex items-center gap-2">
              <TypeIcon type={req.type} />
              <span className="font-mono text-sm font-bold text-primary">{req.jiraIssueKey}</span>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-container rounded-full transition-colors">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">{req.title}</h3>
              <div className="flex items-center gap-2">
                <CoverageChip status={req.status} />
                <span className="text-body-xs text-outline">•</span>
                <span className="text-body-xs text-on-surface-variant">Jira Status: {req.status}</span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-outline-variant">
              <div>
                <label className="font-label-sm text-label-sm text-outline uppercase block mb-1">Type</label>
                <div className="flex items-center gap-2">
                  <TypeIcon type={req.type} />
                  <span className="text-body-sm capitalize">{req.type.toLowerCase()}</span>
                </div>
              </div>

              {req.component && (
                <div>
                  <label className="font-label-sm text-label-sm text-outline uppercase block mb-1">Product</label>
                  <span className="px-2 py-0.5 border border-outline-variant rounded text-[11px] font-bold text-outline uppercase">
                    {req.component}
                  </span>
                </div>
              )}

              {req.parentEpicKey && (
                <div>
                  <label className="font-label-sm text-label-sm text-outline uppercase block mb-1">Parent Epic</label>
                  <span className="font-mono text-sm text-primary font-semibold">{req.parentEpicKey}</span>
                </div>
              )}

              {/* Recent activity */}
              <section>
                <h4 className="font-label-sm text-label-sm text-outline uppercase mb-3">Recent Activity (Jira)</h4>
                <div className="space-y-4">
                  {jiraStatus.lastSyncedAt && (
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">sync</span>
                      </div>
                      <div className="text-body-sm">
                        <span className="font-bold">System</span> synced updates from Jira
                        <p className="text-[11px] text-outline mt-1">
                          {new Date(jiraStatus.lastSyncedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {!jiraStatus.lastSyncedAt && (
                    <p className="text-body-sm text-on-surface-variant">No activity recorded yet.</p>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-6 border-t border-outline-variant bg-surface-container-low flex flex-col gap-2">
            <button
              onClick={() => onCreateTestCase(req)}
              className="w-full px-4 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center justify-center gap-2 h-[38px] bg-white font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create Test Case
            </button>
            <Link
              href={`/requirements/${req.id}`}
              className="w-full bg-primary text-white py-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all text-center h-[38px]"
            >
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
              View Traceability Details
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function RequirementsPage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jiraStatus, setJiraStatus] = useState<JiraConnectionStatus>({ connected: false });
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [caseSuccessMessage, setCaseSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('All Products');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [priorityFilter, setPriorityFilter] = useState('All Priorities');
  const [uncoveredOnly, setUncoveredOnly] = useState(false);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [selectedRelease, setSelectedRelease] = useState('ALL');

  // View Options State
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [tableDensity, setTableDensity] = useState<'compact' | 'normal' | 'relaxed'>('normal');
  const [visibleColumns, setVisibleColumns] = useState({
    id: true,
    title: true,
    product: true,
    release: true,
    priority: true,
    coverage: true,
  });
  const [sortBy, setSortBy] = useState<'default' | 'key' | 'title' | 'priority'>('default');

  // Notifications State
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const viewOptRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Detail pane
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);

  // Create Test Case Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [targetReq, setTargetReq] = useState<Requirement | null>(null);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseSuiteId, setCaseSuiteId] = useState('');
  const [casePriority, setCasePriority] = useState<TestCasePriority>('MEDIUM');
  const [caseType, setCaseType] = useState<TestCaseType>('FUNCTIONAL');
  const [creatingCase, setCreatingCase] = useState(false);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (viewOptRef.current && !viewOptRef.current.contains(e.target as Node)) {
        setViewOptionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    setUser(currentUser);

    try {
      const [reqs, projs, status, suitesData] = await Promise.all([
        fetchRequirements(),
        fetchApi('/projects'),
        fetchApi('/jira/status'),
        fetchTestSuites(),
      ]);
      setRequirements(reqs);
      setProjects(projs);
      setJiraStatus(status);
      setSuites(suitesData);
      if (projs.length > 0 && !selectedProjectKey) {
        setSelectedProjectKey(projs[0].key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  }, [router, selectedProjectKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Sync handler ───────────────────────────────────────────────────────────

  const handleSync = async () => {
    const keyToSync = selectedProjectKey || (projects[0]?.key ?? '');
    if (!keyToSync) return;
    setSyncing(true);
    setError(null);
    try {
      await fetchApi('/jira/sync', {
        method: 'POST',
        body: JSON.stringify({ projectKey: keyToSync }),
      });
      await loadData();
      setShowSyncSuccess(true);
      setTimeout(() => {
        setShowSyncSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Create Test Case Modal Handlers ────────────────────────────────────────

  const handleOpenCreateModal = (req: Requirement) => {
    setTargetReq(req);
    setCaseTitle(`Validate ${req.title}`);
    setCaseSuiteId('');
    setCasePriority('MEDIUM');
    setCaseType('FUNCTIONAL');
    setCreateModalOpen(true);
  };

  const handleSaveTestCase = async () => {
    if (!caseTitle.trim() || !targetReq) return;
    setCreatingCase(true);
    setError(null);
    try {
      await createTestCaseFull({
        suiteId: caseSuiteId && caseSuiteId !== '' ? caseSuiteId : undefined,
        title: caseTitle.trim(),
        coverageJiraKey: targetReq.jiraIssueKey,
        priority: casePriority,
        type: caseType,
        approvalStatus: 'DRAFT',
        version: 'v1',
      });

      await loadData();
      setCreateModalOpen(false);
      setCaseSuccessMessage(`Test case created and linked to ${targetReq.jiraIssueKey}!`);
      setTimeout(() => setCaseSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create test case');
    } finally {
      setCreatingCase(false);
    }
  };

  // ── Export Handler ─────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (requirements.length === 0) {
      setError('No requirements available to export.');
      return;
    }

    const headers = ['ID', 'Jira Key', 'Title', 'Type', 'Product', 'Release', 'Priority', 'Status'];
    const rows = filtered.map((r) => [
      `"${r.id || ''}"`,
      `"${r.jiraIssueKey || ''}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${r.type || ''}"`,
      `"${(r.component || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${selectedRelease}"`,
      `"P1 - High"`,
      `"${r.status || 'To Do'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `qatrack-requirements-${selectedProjectKey || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Distinct products (components)
  const availableProducts = useMemo(() => {
    return Array.from(new Set(requirements.map((r) => r.component).filter(Boolean))) as string[];
  }, [requirements]);

  const uncoveredCount = useMemo(() => {
    return requirements.filter(
      (r) => !['done', 'closed', 'resolved'].includes(r.status?.toLowerCase() ?? ''),
    ).length;
  }, [requirements]);

  // Notifications List
  const notificationsList = useMemo(() => {
    const list = [
      {
        id: 'notif-1',
        title: 'Jira Sync Status',
        desc: jiraStatus.lastSyncedAt
          ? `Last synchronized at ${new Date(jiraStatus.lastSyncedAt).toLocaleTimeString()}`
          : 'Ready to synchronize with Jira.',
        time: 'Recent',
        type: 'sync',
      },
      {
        id: 'notif-2',
        title: 'Requirement Coverage Alert',
        desc: `${uncoveredCount} requirement${uncoveredCount !== 1 ? 's' : ''} currently uncovered.`,
        time: 'Live',
        type: 'alert',
      },
      {
        id: 'notif-3',
        title: 'Test Management',
        desc: `${suites.length} test suite${suites.length !== 1 ? 's' : ''} registered and active.`,
        time: 'Today',
        type: 'info',
      },
    ];
    return list;
  }, [jiraStatus, uncoveredCount, suites]);

  const availableReleases = useMemo(() => {
    const set = new Set<string>();
    for (const r of requirements) {
      if (r.release && r.release !== 'ALL') set.add(r.release);
    }
    for (const s of suites) {
      if (s.release && s.release !== 'Unassigned' && s.release !== 'ALL') set.add(s.release);
    }
    if (set.size === 0) {
      return ['v2.4.0 (Current)', 'v2.5.0 (Next)', 'Backlog'];
    }
    return Array.from(set);
  }, [requirements, suites]);

  const unreadNotifCount = notificationsList.filter((n) => !readNotifications.includes(n.id)).length;

  // ── Filtering & Sorting ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = requirements.filter((r) => {
      // Project filter
      if (selectedProjectKey && !['PE', 'UI', 'AC'].includes(selectedProjectKey)) {
        if (!r.jiraIssueKey.startsWith(`${selectedProjectKey}-`)) return false;
      }
      // Uncovered Only filter
      if (uncoveredOnly) {
        const isCovered = ['done', 'closed', 'resolved'].includes(r.status?.toLowerCase() ?? '');
        if (isCovered) return false;
      }
      // Release filter
      if (selectedRelease !== 'ALL') {
        if (r.release && r.release !== selectedRelease) return false;
      }
      // Product (component) filter
      if (productFilter !== 'All Products') {
        if ((r.component || 'Uncategorized') !== productFilter) return false;
      }
      // Type filter
      if (typeFilter !== 'All Types') {
        const formattedType = r.type.toLowerCase();
        if (typeFilter === 'Epics' && formattedType !== 'epic') return false;
        if (typeFilter === 'Stories' && formattedType !== 'story') return false;
        if (typeFilter === 'Bugs' && formattedType !== 'bug') return false;
        if (typeFilter === 'Tasks' && formattedType !== 'task') return false;
      }
      // Priority filter
      if (priorityFilter !== 'All Priorities') {
        const prio = getPriorityIndicator().label;
        if (priorityFilter !== prio) return false;
      }
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesKey = r.jiraIssueKey.toLowerCase().includes(q);
        const matchesComponent = r.component?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesKey && !matchesComponent) return false;
      }
      return true;
    });

    if (sortBy === 'key') {
      list = [...list].sort((a, b) => a.jiraIssueKey.localeCompare(b.jiraIssueKey));
    } else if (sortBy === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }

    return list;
  }, [requirements, selectedProjectKey, selectedRelease, uncoveredOnly, productFilter, typeFilter, priorityFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const currentProjectName =
    projects.find((p) => p.key === selectedProjectKey)?.name ||
    jiraStatus.siteName ||
    (projects[0]?.name ?? 'Project Alpha');

  // Padding class by density
  const cellPaddingClass =
    tableDensity === 'compact'
      ? 'py-2 px-cell-padding-h'
      : tableDensity === 'relaxed'
        ? 'py-4 px-cell-padding-h'
        : 'py-cell-padding-v px-cell-padding-h';

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading requirements…
        </div>
      </div>
    );
  }

  const syncedAt = jiraStatus.lastSyncedAt
    ? new Date(jiraStatus.lastSyncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-on-surface font-body-md overflow-hidden">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] relative overflow-hidden">
        {/* ── TopNavBar - JSON Execution ── */}
        <header className="h-14 w-full sticky top-0 z-50 bg-white border-b border-outline-variant shadow-sm flex justify-between items-center px-gutter gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="relative w-64 md:w-80 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                search
              </span>
              <input
                className="w-full pl-10 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface"
                placeholder="Search requirements..."
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

            <div className="h-6 w-[1px] bg-outline-variant mx-1 hidden sm:block shrink-0"></div>

            <div className="flex items-center gap-6 flex-nowrap shrink-0">
              {/* PRODUCT Selector */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider whitespace-nowrap">
                  PRODUCT:
                </span>
                <select
                  className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0 text-on-surface font-semibold outline-none whitespace-nowrap"
                  value={selectedProjectKey}
                  onChange={(e) => {
                    setSelectedProjectKey(e.target.value);
                    setPage(1);
                  }}
                >
                  {projects.length === 0 ? (
                    <>
                      <option value="PE">Platform Engine (PE)</option>
                      <option value="UI">User Interface (UI)</option>
                      <option value="AC">API Core (AC)</option>
                    </>
                  ) : (
                    projects.map((p) => (
                      <option key={p.key} value={p.key} className="bg-white text-on-surface">
                        {p.name} ({p.key})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Release Selector */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider whitespace-nowrap">
                  Release:
                </span>
                <select
                  className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0 text-on-surface font-semibold outline-none whitespace-nowrap"
                  value={selectedRelease}
                  onChange={(e) => {
                    setSelectedRelease(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All Releases</option>
                  {availableReleases.map((rel) => (
                    <option key={rel} value={rel} className="bg-white text-on-surface">
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSync}
              disabled={syncing || (!selectedProjectKey && projects.length === 0)}
              className="px-4 py-1.5 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed h-[34px] cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              {syncing ? 'Syncing…' : 'Sync with Jira'}
            </button>

            <div className="relative flex items-center gap-1 border-l border-outline-variant pl-4" ref={notifRef}>
              {/* Notifications */}
              <button
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="p-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded-full hover:bg-surface-container cursor-pointer relative"
                title="Notifications"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full ring-2 ring-white animate-pulse" />
                )}
              </button>

              {/* Notifications Popover */}
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in text-sm">
                  <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
                    <span className="font-headline-sm text-sm font-bold text-on-surface">Notifications</span>
                    <button
                      onClick={() => setReadNotifications(notificationsList.map((n) => n.id))}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="divide-y divide-outline-variant/40 max-h-72 overflow-y-auto">
                    {notificationsList.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 hover:bg-surface-container-low transition-colors cursor-pointer ${
                          !readNotifications.includes(n.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-on-surface">{n.title}</span>
                          <span className="text-[10px] text-outline">{n.time}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-snug">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Settings */}
              <button
                onClick={() => setViewOptionsOpen((prev) => !prev)}
                title="View & Display Settings"
                className="p-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>

              {/* Help */}
              <button
                onClick={() => {
                  alert('QATrack Requirements Management:\n\n• Search: Filter requirements by title, Jira key, or component.\n• Product: Switch active Jira project.\n• Release: Filter issues scoped to a release.\n• Sync: Fetch live requirements & traceability from Jira.');
                }}
                title="Help & Info"
                className="p-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined">help_outline</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Breadcrumbs & Title */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <nav className="flex items-center gap-2 text-outline font-label-md text-label-md mb-1">
                <span>{currentProjectName}</span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-on-surface font-semibold">Requirements</span>
              </nav>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">Jira Requirements</h2>
            </div>

            {/* Action Buttons with functioning View Options & Export */}
            <div className="flex gap-2">
              {/* View Options Dropdown */}
              <div className="relative" ref={viewOptRef}>
                <button
                  onClick={() => setViewOptionsOpen((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg font-label-md text-label-md transition-colors ${
                    viewOptionsOpen
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-outline-variant hover:bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  View Options
                  <span className="material-symbols-outlined text-[14px]">
                    {viewOptionsOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {viewOptionsOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 p-4 space-y-4 animate-fade-in text-sm">
                    <div>
                      <span className="text-xs font-bold uppercase text-outline block mb-2">Table Density</span>
                      <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-1 rounded-lg">
                        {(['compact', 'normal', 'relaxed'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setTableDensity(d)}
                            className={`py-1 text-xs rounded capitalize transition-all ${
                              tableDensity === d
                                ? 'bg-white font-bold text-primary shadow-sm'
                                : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-outline-variant/60 pt-3">
                      <span className="text-xs font-bold uppercase text-outline block mb-2">Visible Columns</span>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.product}
                            onChange={(e) => setVisibleColumns((c) => ({ ...c, product: e.target.checked }))}
                            className="rounded border-outline text-primary focus:ring-primary/20"
                          />
                          Product
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.release}
                            onChange={(e) => setVisibleColumns((c) => ({ ...c, release: e.target.checked }))}
                            className="rounded border-outline text-primary focus:ring-primary/20"
                          />
                          Release
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.priority}
                            onChange={(e) => setVisibleColumns((c) => ({ ...c, priority: e.target.checked }))}
                            className="rounded border-outline text-primary focus:ring-primary/20"
                          />
                          Priority
                        </label>
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={visibleColumns.coverage}
                            onChange={(e) => setVisibleColumns((c) => ({ ...c, coverage: e.target.checked }))}
                            className="rounded border-outline text-primary focus:ring-primary/20"
                          />
                          Coverage Status
                        </label>
                      </div>
                    </div>

                    <div className="border-t border-outline-variant/60 pt-3">
                      <span className="text-xs font-bold uppercase text-outline block mb-2">Sort Order</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full text-xs p-1.5 bg-surface-container-low border border-outline-variant rounded-lg"
                      >
                        <option value="default">Default Order</option>
                        <option value="key">Jira Key (A-Z)</option>
                        <option value="title">Title (A-Z)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors text-on-surface-variant active:scale-95"
                title="Export filtered requirements to CSV"
              >
                <span className="material-symbols-outlined text-[18px]">file_download</span>
                Export
              </button>
            </div>
          </div>

          {/* Green Synced with Jira Banner (Auto-dismisses after 3s) */}
          {showSyncSuccess && (
            <div className="mb-4 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between animate-fade-in transition-all">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                <p className="text-body-sm text-on-secondary-container">
                  Last synced with Jira: <span className="font-bold">{syncedAt ? `Today at ${syncedAt}` : 'Just now'}</span>
                </p>
              </div>
              <button
                onClick={() => setShowSyncSuccess(false)}
                className="text-on-secondary-container/70 hover:text-on-secondary-container p-1"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* Green Test Case Created Banner */}
          {caseSuccessMessage && (
            <div className="mb-4 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between animate-fade-in transition-all">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                <p className="text-body-sm text-on-secondary-container font-medium">{caseSuccessMessage}</p>
              </div>
              <button
                onClick={() => setCaseSuccessMessage(null)}
                className="text-on-secondary-container/70 hover:text-on-secondary-container p-1"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          )}

          {/* Warning Banner with functioning "View Items" filter */}
          {uncoveredCount > 0 && !uncoveredOnly && (
            <div className="mb-6 p-4 bg-error-container border-l-4 border-error rounded-r-lg flex items-start gap-4 animate-pulse">
              <span className="material-symbols-outlined text-error mt-0.5">warning</span>
              <div className="flex-1">
                <p className="font-label-md text-label-md text-on-error-container font-bold">Action Required</p>
                <p className="font-body-sm text-body-sm text-on-error-container">
                  {uncoveredCount} requirement{uncoveredCount !== 1 ? 's' : ''} detected — no test cases assigned yet. Ensure coverage is maintained.
                </p>
              </div>
              <button
                onClick={() => {
                  setUncoveredOnly(true);
                  setPage(1);
                }}
                className="text-error font-label-md text-label-md underline underline-offset-2 hover:text-error/80 cursor-pointer font-bold shrink-0"
              >
                View Items
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-error-container border border-error rounded-lg flex items-center gap-2 text-body-sm text-on-error-container">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Filter Bar with Product Field */}
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 bg-white p-3 rounded-xl border border-outline-variant shadow-sm">
            {/* Product Filter (changed from Component) */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Product:</span>
              <select
                value={productFilter}
                onChange={(e) => {
                  setProductFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0"
              >
                <option>All Products</option>
                {availableProducts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant hidden sm:block"></div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0"
              >
                <option>All Types</option>
                <option>Epics</option>
                <option>Stories</option>
                <option>Bugs</option>
                <option>Tasks</option>
              </select>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant hidden sm:block"></div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0"
              >
                <option>All Priorities</option>
                <option>P1 - High</option>
                <option>P2 - Medium</option>
                <option>P3 - Low</option>
              </select>
            </div>

            {/* Uncovered Only Filter Badge / Toggle */}
            {uncoveredOnly && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-error-container text-on-error-container rounded-lg text-xs font-bold animate-fade-in">
                <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                <span>Uncovered Only ({filtered.length})</span>
                <button
                  onClick={() => setUncoveredOnly(false)}
                  className="ml-1 hover:opacity-75 p-0.5 rounded"
                  title="Remove Uncovered Only filter"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            <div className="ml-auto">
              <button
                onClick={() => {
                  setSearch('');
                  setProductFilter('All Products');
                  setTypeFilter('All Types');
                  setPriorityFilter('All Priorities');
                  setUncoveredOnly(false);
                  setPage(1);
                }}
                className="text-primary font-label-md text-label-md hover:underline"
              >
                Clear all filters
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="flex-1 bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead className="bg-surface-container-lowest sticky top-0 z-10">
                  <tr>
                    {visibleColumns.id && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">ID</th>
                    )}
                    {visibleColumns.title && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">Title</th>
                    )}
                    {visibleColumns.product && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">Product</th>
                    )}
                    {visibleColumns.release && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">Release</th>
                    )}
                    {visibleColumns.priority && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">Priority</th>
                    )}
                    {visibleColumns.coverage && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">Coverage Status</th>
                    )}
                    <th className="px-cell-padding-h py-3 border-b border-outline-variant text-right pr-6 font-label-sm text-label-sm text-outline uppercase min-w-[180px] pr-gutter">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[48px] block mb-3">search_off</span>
                        {requirements.length === 0
                          ? 'No requirements yet — sync a Jira project using the button above.'
                          : 'No requirements match your filters.'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((req) => {
                      const priority = getPriorityIndicator();
                      return (
                        <tr
                          key={req.id}
                          className="hover:bg-surface-container-low transition-colors cursor-pointer group"
                          onClick={() => setSelectedReq(selectedReq?.id === req.id ? null : req)}
                        >
                          {visibleColumns.id && (
                            <td className={`${cellPaddingClass} font-label-md text-label-md text-primary font-semibold`}>
                              {req.jiraIssueKey}
                            </td>
                          )}
                          {visibleColumns.title && (
                            <td className={cellPaddingClass}>
                              <div className="flex items-center gap-2">
                                <TypeIcon type={req.type} />
                                <span className="font-body-sm text-body-sm text-on-surface font-medium truncate max-w-xs">
                                  {req.title}
                                </span>
                              </div>
                            </td>
                          )}
                          {visibleColumns.product && (
                            <td className={cellPaddingClass}>
                              {req.component ? (
                                <span className="px-2 py-0.5 border border-outline-variant rounded text-[11px] font-bold text-outline uppercase">
                                  {req.component}
                                </span>
                              ) : (
                                <span className="text-on-surface-variant text-body-sm">—</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.release && (
                            <td className={`${cellPaddingClass} text-body-sm text-on-surface-variant`}>
                              {selectedRelease.split(' ')[0]}
                            </td>
                          )}
                          {visibleColumns.priority && (
                            <td className={cellPaddingClass}>
                              <div className={`priority-indicator ${priority.className} pl-3 font-label-sm text-label-sm text-on-surface`}>
                                {priority.label}
                              </div>
                            </td>
                          )}
                          {visibleColumns.coverage && (
                            <td className={cellPaddingClass}>
                              <CoverageChip status={req.status} />
                            </td>
                          )}
                          <td className={`${cellPaddingClass} text-right pr-6 pr-gutter`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCreateModal(req);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all whitespace-nowrap active:scale-95 text-xs bg-white"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                              Create Test Case
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination */}
            <div className="px-cell-padding-h py-3 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-between">
              <span className="font-label-md text-label-md text-outline">
                Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} requirements
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-surface-container-low text-outline disabled:opacity-30"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 rounded font-label-md text-label-md transition-colors ${
                        pageNum === page
                          ? 'bg-primary text-white'
                          : 'hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && <span className="text-outline">...</span>}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-surface-container-low text-outline disabled:opacity-30"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Requirement Detail Preview (Slide-in pane) */}
        <DetailPane
          req={selectedReq}
          jiraStatus={jiraStatus}
          onClose={() => setSelectedReq(null)}
          onCreateTestCase={(req) => handleOpenCreateModal(req)}
        />

        {/* ── Create Test Case Modal from Requirement ── */}
        {createModalOpen && targetReq && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Create Test Case</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Linking coverage to <span className="font-bold text-primary">{targetReq.jiraIssueKey}</span> ({targetReq.title})
                  </p>
                </div>
                <button
                  className="text-neutral hover:text-on-surface p-1 rounded-full hover:bg-surface-container"
                  onClick={() => setCreateModalOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Test Case Title
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                    placeholder="e.g. Validate user checkout with credit card"
                    type="text"
                    value={caseTitle}
                    onChange={(e) => setCaseTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Coverage Jira Key
                  </label>
                  <input
                    className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-sm text-on-surface font-semibold"
                    type="text"
                    value={targetReq.jiraIssueKey}
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Test Suite (Optional)
                  </label>
                  <select
                    value={caseSuiteId}
                    onChange={(e) => setCaseSuiteId(e.target.value)}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="">No Suite (Standalone)</option>
                    {suites
                      .filter((s) => s.id !== 'standalone')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                      Priority
                    </label>
                    <select
                      value={casePriority}
                      onChange={(e) => setCasePriority(e.target.value as TestCasePriority)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary text-sm"
                    >
                      <option value="CRITICAL">L1 - Critical</option>
                      <option value="HIGH">L2 - High</option>
                      <option value="MEDIUM">L3 - Medium</option>
                      <option value="LOW">L4 - Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                      Type
                    </label>
                    <select
                      value={caseType}
                      onChange={(e) => setCaseType(e.target.value as TestCaseType)}
                      className="w-full px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary text-sm"
                    >
                      <option value="FUNCTIONAL">Functional</option>
                      <option value="SMOKE">Smoke</option>
                      <option value="REGRESSION">Regression</option>
                      <option value="PERFORMANCE">Performance</option>
                      <option value="SECURITY">Security</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                <button
                  className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTestCase}
                  disabled={!caseTitle.trim() || creatingCase}
                  className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-white font-semibold"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {creatingCase ? 'progress_activity' : 'add'}
                  </span>
                  {creatingCase ? 'Creating…' : 'Create Test Case'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
