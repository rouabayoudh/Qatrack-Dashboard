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
  fetchAvailableTestCases,
  linkTestCases,
  type CurrentUser,
} from '@/lib/api';
import type {
  Requirement,
  RequirementType,
  JiraConnectionStatus,
  Project,
  TestSuite,
  TestCase,
  TestCasePriority,
  TestCaseType,
} from '@qatrack/shared-types';
import { Sidebar } from '../dashboard/components/Sidebar';
import { TopBar } from '../dashboard/components/TopBar';

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
  if (done) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary-container/30 text-[11px] font-bold text-on-secondary-container">
        <span className="w-1 h-1 rounded-full bg-secondary mr-1.5" />
        Covered
      </span>
    );
  }
  if (s === 'in progress') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">
        <span className="w-1 h-1 rounded-full bg-amber-500 mr-1.5" />
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-error-container text-[11px] font-bold text-on-error-container">
      <span className="w-1 h-1 rounded-full bg-error mr-1.5" />
      Uncovered
    </span>
  );
}

function PriorityCell({ priority }: { priority?: string }) {
  const p = (priority || 'High').toLowerCase();

  if (p.includes('low') || p.includes('p3')) {
    return (
      <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
        <svg className="w-4 h-4 text-[#2563eb] flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 6 5 5 5-5"></path>
        </svg>
        <span>Low</span>
      </div>
    );
  }

  if (p.includes('medium') || p.includes('p2')) {
    return (
      <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
        <svg className="w-4 h-4 text-[#f97316] flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 8 5-4 5 4"></path>
          <path d="m3 13 5-4 5 4"></path>
        </svg>
        <span>Medium</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
      <svg className="w-4 h-4 text-[#f97316] flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 10 5-5 5 5"></path>
      </svg>
      <span>High</span>
    </div>
  );
}

// ── Detail Pane Component ─────────────────────────────────────────────────────

function DetailPane({
  req,
  jiraStatus,
  onClose,
  onCreateTestCase,
  onLinkTestCase,
}: {
  req: Requirement | null;
  jiraStatus: JiraConnectionStatus;
  onClose: () => void;
  onCreateTestCase: (req: Requirement) => void;
  onLinkTestCase: (req: Requirement) => void;
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
      className={`fixed top-14 right-0 bottom-0 w-[400px] bg-white border-l border-outline-variant shadow-2xl z-40 flex flex-col transition-transform duration-300 ${
        req ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {req && (
        <>
          {/* Header */}
          <div className="p-6 border-b border-outline-variant flex items-start justify-between bg-surface-container-low">
            <div>
              <p className="font-label-md text-label-md text-primary font-bold mb-1">{req.jiraIssueKey}</p>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{req.title}</h3>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-surface-container-low rounded-full transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <section>
              <h4 className="font-label-sm text-label-sm text-outline uppercase mb-2">Description</h4>
              <p className="text-body-sm text-on-surface leading-relaxed">
                {req.description || req.title || 'No description provided.'}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-label-sm text-label-sm text-outline uppercase mb-2">Jira Status</h4>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                  <span className="font-label-md text-label-md">{req.status}</span>
                </div>
              </div>
              <div>
                <h4 className="font-label-sm text-label-sm text-outline uppercase mb-2">Coverage</h4>
                <CoverageChip status={req.status} />
              </div>
            </div>

            {req.component && (
              <div>
                <h4 className="font-label-sm text-label-sm text-outline uppercase mb-2">Product / Component</h4>
                <span className="px-2 py-0.5 border border-outline-variant rounded text-[11px] text-outline uppercase font-bold">
                  {req.component}
                </span>
              </div>
            )}

            {/* Recent activity */}
            <section>
              <h4 className="font-label-sm text-label-sm text-outline uppercase mb-3">Recent Activity (Jira)</h4>
              <div className="space-y-4">
                {jiraStatus.lastSyncedAt && (
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">sync</span>
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

          {/* Footer actions */}
          <div className="p-6 border-t border-outline-variant bg-surface-container-low flex flex-col gap-2">
            <button
              onClick={() => onCreateTestCase(req)}
              className="w-full bg-primary text-white py-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-all cursor-pointer font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create Test Case
            </button>
            <Link
              href={`/requirements/${req.id}`}
              className="w-full bg-white border border-outline-variant text-on-surface py-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all cursor-pointer font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              View Details
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

  // Filters matching exact HTML
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('All Products');
  const [releaseFilter, setReleaseFilter] = useState('All Releases');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [priorityFilter, setPriorityFilter] = useState('All Priorities');
  const [uncoveredOnly, setUncoveredOnly] = useState(false);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');

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

  // Notifications State (viewOptionsOpen remains for the filter bar View Options dropdown)
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

  // Link Test Case Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTargetReq, setLinkTargetReq] = useState<Requirement | null>(null);
  const [availableCases, setAvailableCases] = useState<TestCase[]>([]);
  const [selectedToLink, setSelectedToLink] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
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

  // ── Link Test Case Modal Handlers ──────────────────────────────────────────

  const handleOpenLinkModal = async (req: Requirement) => {
    setLinkTargetReq(req);
    setSelectedToLink([]);
    setModalSearch('');
    try {
      const avail = await fetchAvailableTestCases(req.id);
      setAvailableCases(avail);
      setLinkModalOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch available test cases');
    }
  };

  const handleConfirmLink = async () => {
    if (!selectedToLink.length || !linkTargetReq) return;
    setLinking(true);
    try {
      await linkTestCases(linkTargetReq.id, selectedToLink);
      setLinkModalOpen(false);
      setSelectedToLink([]);
      await loadData();
      setCaseSuccessMessage(`Linked ${selectedToLink.length} test case(s) to ${linkTargetReq.jiraIssueKey}!`);
      setTimeout(() => setCaseSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to link test cases');
    } finally {
      setLinking(false);
    }
  };

  // ── Export Handler ─────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (requirements.length === 0) {
      setError('No requirements available to export.');
      return;
    }

    const headers = ['ID', 'Title', 'PRODUCT', 'Release', 'Priority', 'Coverage Status'];
    const rows = filtered.map((r) => [
      `"${r.jiraIssueKey || r.id || ''}"`,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.component || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${r.release || releaseFilter || 'v2.4.0'}"`,
      `"${r.priority || 'High'}"`,
      `"${['done', 'closed', 'resolved'].includes(r.status?.toLowerCase() ?? '') ? 'Covered' : 'Uncovered'}"`,
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

  // Distinct products (components) derived dynamically from real synced data
  const availableProducts = useMemo(() => {
    return Array.from(new Set(requirements.map((r) => r.component).filter(Boolean))) as string[];
  }, [requirements]);

  const uncoveredCount = useMemo(() => {
    return requirements.filter(
      (r) => !['done', 'closed', 'resolved'].includes(r.status?.toLowerCase() ?? ''),
    ).length;
  }, [requirements]);

  const availableReleases = useMemo(() => {
    const set = new Set<string>();
    for (const r of requirements) {
      if (r.release && r.release !== 'ALL') set.add(r.release);
    }
    if (set.size === 0) {
      return ['v2.4.0 (Current)', 'v2.5.0 (Next)', 'Backlog'];
    }
    return Array.from(set);
  }, [requirements]);

  // ── Filtering & Sorting ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = requirements.filter((r) => {
      // Project filter
      if (selectedProjectKey) {
        if (!r.jiraIssueKey.startsWith(`${selectedProjectKey}-`)) return false;
      }
      // Uncovered Only filter
      if (uncoveredOnly) {
        const isCovered = ['done', 'closed', 'resolved'].includes(r.status?.toLowerCase() ?? '');
        if (isCovered) return false;
      }
      // Release filter
      if (releaseFilter !== 'All Releases') {
        if (r.release && !r.release.includes(releaseFilter.split(' ')[0])) return false;
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
        const p = (r.priority || 'High').toLowerCase();
        if (priorityFilter.includes('High') && (!p.includes('high') && !p.includes('p1') && !p.includes('critical'))) return false;
        if (priorityFilter.includes('Medium') && (!p.includes('medium') && !p.includes('p2'))) return false;
        if (priorityFilter.includes('Low') && (!p.includes('low') && !p.includes('p3'))) return false;
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
  }, [requirements, selectedProjectKey, releaseFilter, uncoveredOnly, productFilter, typeFilter, priorityFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const currentProjectName =
    projects.find((p) => p.key === selectedProjectKey)?.name ||
    jiraStatus.siteName ||
    (projects[0]?.name ?? 'Project Alpha');

  // Density padding
  const cellPaddingClass =
    tableDensity === 'compact'
      ? 'py-2 px-cell-padding-h'
      : tableDensity === 'relaxed'
        ? 'py-4 px-cell-padding-h'
        : 'py-cell-padding-v px-cell-padding-h';

  const filteredAvailableCases = useMemo(() => {
    if (!modalSearch) return availableCases;
    const query = modalSearch.toLowerCase();
    return availableCases.filter(
      (tc) =>
        tc.id.toLowerCase().includes(query) ||
        tc.title.toLowerCase().includes(query) ||
        tc.tags?.some((t) => t.toLowerCase().includes(query)),
    );
  }, [availableCases, modalSearch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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
    <div className="flex h-screen w-full bg-background text-on-surface font-body-md overflow-hidden">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        {/* Functional TopBar with working notifications, settings & help */}
        <TopBar syncing={syncing} onSync={handleSync} />



        {/* ── Page Content ── */}

        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Green Synced Banner */}
          {showSyncSuccess && (
            <div className="mb-6 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">check_circle</span>
                <p className="text-body-sm text-on-secondary-container">
                  Last synced with Jira: <span className="font-bold">{syncedAt ? `Today at ${syncedAt}` : 'Just now'}</span>
                </p>
              </div>
              <button onClick={() => setShowSyncSuccess(false)} className="text-primary font-label-md text-label-md hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {caseSuccessMessage && (
            <div className="mb-6 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">check_circle</span>
                <p className="text-body-sm text-on-secondary-container font-semibold">{caseSuccessMessage}</p>
              </div>
              <button onClick={() => setCaseSuccessMessage(null)} className="text-primary font-label-md text-label-md hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Breadcrumbs & Title */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <nav className="flex items-center gap-2 text-outline font-label-md text-label-md mb-1">
                <span>{currentProjectName}</span>
                <span className="material-symbols-outlined text-xs">chevron_right</span>
                <span className="text-on-surface">Requirements</span>
              </nav>
              <h2 className="font-bold text-2xl md:text-3xl text-on-surface tracking-tight">Jira Requirements</h2>
            </div>
            <div className="flex gap-2">
              <div className="relative" ref={viewOptRef}>
                <button
                  onClick={() => setViewOptionsOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  View Options
                </button>

                {viewOptionsOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-outline-variant rounded-xl shadow-2xl z-50 p-4 space-y-4 text-sm">
                    <div>
                      <span className="text-xs font-bold uppercase text-outline block mb-2">Table Density</span>
                      <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-1 rounded-lg">
                        {(['compact', 'normal', 'relaxed'] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setTableDensity(d)}
                            className={`py-1 text-xs rounded capitalize transition-all cursor-pointer ${
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
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">file_download</span>
                Export
              </button>
            </div>
          </div>

          {/* Warning Banner */}
          {uncoveredCount > 0 && (
            <div className="mb-6 p-4 bg-error-container border-l-4 border-error rounded-r-lg flex items-start gap-4 animate-pulse">
              <span className="material-symbols-outlined text-error mt-0.5">warning</span>
              <div className="flex-1">
                <p className="font-label-md text-label-md text-on-error-container font-bold">Action Required</p>
                <p className="font-body-sm text-body-sm text-on-error-container">
                  {uncoveredCount} requirement{uncoveredCount !== 1 ? 's' : ''} detected — no test cases assigned yet. Ensure coverage is maintained for your Jira items.
                </p>
              </div>
              <button
                onClick={() => {
                  setUncoveredOnly(true);
                  setPage(1);
                }}
                className="text-error font-label-md text-label-md underline underline-offset-2 hover:text-error/80 cursor-pointer"
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

          {/* Filter Bar */}
          <div className="mb-4 flex items-center gap-4 bg-white p-3 rounded-xl border border-outline-variant shadow-sm flex-wrap">
            {/* Product Filter */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Product:</span>
              <select
                value={productFilter}
                onChange={(e) => {
                  setProductFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer"
              >
                <option>All Products</option>
                {availableProducts.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant"></div>

            {/* Release Filter */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Release:</span>
              <select
                value={releaseFilter}
                onChange={(e) => {
                  setReleaseFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer"
              >
                <option>All Releases</option>
                {availableReleases.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant"></div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer"
              >
                <option>All Types</option>
                <option>Epics</option>
                <option>Stories</option>
                <option>Bugs</option>
                <option>Tasks</option>
              </select>
            </div>
            <div className="h-4 w-[1px] bg-outline-variant"></div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer"
              >
                <option>All Priorities</option>
                <option>P1 - High</option>
                <option>P2 - Medium</option>
                <option>P3 - Low</option>
              </select>
            </div>

            {uncoveredOnly && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-error-container text-on-error-container rounded-lg text-xs font-bold">
                <span>Uncovered Only ({filtered.length})</span>
                <button onClick={() => setUncoveredOnly(false)} className="ml-1 hover:opacity-75">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            )}

            <div className="ml-auto">
              <button
                onClick={() => {
                  setSearch('');
                  setProductFilter('All Products');
                  setReleaseFilter('All Releases');
                  setTypeFilter('All Types');
                  setPriorityFilter('All Priorities');
                  setUncoveredOnly(false);
                  setPage(1);
                }}
                className="text-primary font-label-md text-label-md hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="flex-1 bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar flex-1">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-surface-container-low sticky top-0 z-10">
                  <tr>
                    {visibleColumns.id && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                        ID
                      </th>
                    )}
                    {visibleColumns.title && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                        Title
                      </th>
                    )}
                    {visibleColumns.product && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                        PRODUCT
                      </th>
                    )}
                    {visibleColumns.release && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                        Release
                      </th>
                    )}
                    {visibleColumns.priority && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                        Priority
                      </th>
                    )}
                    {visibleColumns.coverage && (
                      <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                        Coverage Status
                      </th>
                    )}
                    <th className="px-cell-padding-h py-3 border-b border-outline-variant font-label-sm text-label-sm text-outline uppercase">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[48px] block mb-3">search_off</span>
                        {requirements.length === 0
                          ? 'No Jira requirements synced yet — click "Sync with Jira" to fetch real issues from your account.'
                          : 'No requirements match your current filters.'}
                      </td>
                    </tr>
                  ) : (
                    paginated.map((req) => (
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
                            <span className="px-2 py-0.5 border border-outline-variant rounded text-[11px] text-outline uppercase font-bold">
                              {req.component || 'General'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.release && (
                          <td className={`${cellPaddingClass} text-body-sm text-on-surface-variant`}>
                            {req.release || 'v2.4.0'}
                          </td>
                        )}
                        {visibleColumns.priority && (
                          <td className={cellPaddingClass}>
                            <PriorityCell priority={req.priority} />
                          </td>
                        )}
                        {visibleColumns.coverage && (
                          <td className={cellPaddingClass}>
                            <CoverageChip status={req.status} />
                          </td>
                        )}
                        <td className={cellPaddingClass} onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1.5 items-start py-1">
                            <button
                              onClick={() => handleOpenCreateModal(req)}
                              className="flex items-center gap-1.5 px-2.5 py-1 border border-primary text-primary rounded-lg font-label-md text-label-md hover:bg-primary/5 transition-colors active:scale-95 w-full justify-center bg-white cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">add</span>
                              Create Test Case
                            </button>
                            <button
                              onClick={() => handleOpenLinkModal(req)}
                              className="flex items-center gap-1.5 px-2.5 py-1 border border-outline-variant text-on-surface-variant rounded-lg font-label-md text-label-md hover:bg-surface-container-low transition-colors active:scale-95 w-full justify-center bg-white cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">link</span>
                              Link Test Case
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
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
                  className="p-1 rounded hover:bg-surface-container-low text-outline disabled:opacity-30 cursor-pointer"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 rounded font-label-md text-label-md transition-colors cursor-pointer ${
                        pageNum === page
                          ? 'bg-primary text-white font-bold'
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
                  className="p-1 rounded hover:bg-surface-container-low text-outline disabled:opacity-30 cursor-pointer"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Slide-in Detail Pane */}
        <DetailPane
          req={selectedReq}
          jiraStatus={jiraStatus}
          onClose={() => setSelectedReq(null)}
          onCreateTestCase={(req) => handleOpenCreateModal(req)}
          onLinkTestCase={(req) => handleOpenLinkModal(req)}
        />

        {/* Create Test Case Modal */}
        {createModalOpen && targetReq && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in">
              <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Create Test Case</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Linking coverage to <span className="font-bold text-primary">{targetReq.jiraIssueKey}</span> ({targetReq.title})
                  </p>
                </div>
                <button
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
                  onClick={() => setCreateModalOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">
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
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">
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
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">
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
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">
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
                    <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">
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
              <div className="p-6 bg-surface-container-low rounded-b-xl flex justify-end gap-3">
                <button
                  className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTestCase}
                  disabled={!caseTitle.trim() || creatingCase}
                  className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed bg-white font-semibold cursor-pointer"
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

        {/* Link Test Case Modal */}
        {linkModalOpen && linkTargetReq && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh] animate-fade-in">
              <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Link Existing Test Cases</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Linking coverage to <span className="font-bold text-primary">{linkTargetReq.jiraIssueKey}</span>
                  </p>
                </div>
                <button
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-container cursor-pointer"
                  onClick={() => setLinkModalOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
                    search
                  </span>
                  <input
                    autoFocus
                    className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Search by ID, title, or tags..."
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                </div>

                <div className="custom-scrollbar overflow-y-auto space-y-2 max-h-[360px] flex-1 pr-1">
                  {filteredAvailableCases.length === 0 ? (
                    <div className="py-12 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-[32px] block mb-2 opacity-50">
                        check_circle
                      </span>
                      {availableCases.length === 0
                        ? 'All available test cases are already linked to this requirement.'
                        : 'No test cases match your search filter.'}
                    </div>
                  ) : (
                    filteredAvailableCases.map((tc) => {
                      const isSelected = selectedToLink.includes(tc.id);
                      return (
                        <div
                          key={tc.id}
                          onClick={() => {
                            setSelectedToLink((prev) =>
                              prev.includes(tc.id) ? prev.filter((id) => id !== tc.id) : [...prev, tc.id],
                            );
                          }}
                          className={`flex items-center gap-4 p-3 rounded-xl border transition-all cursor-pointer group ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-outline-variant hover:bg-surface-container-low'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary text-white'
                                : 'border-outline group-hover:border-primary'
                            }`}
                          >
                            {isSelected && (
                              <span className="material-symbols-outlined text-[14px]">check</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-body-md font-semibold text-primary">{tc.id}</p>
                            <p className="text-body-sm text-on-surface truncate">{tc.title}</p>
                          </div>
                          {tc.tags && tc.tags.length > 0 && (
                            <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0">
                              {tc.tags[0]}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-6 bg-surface-container-low rounded-b-xl flex justify-end gap-3">
                <button
                  className="px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                  onClick={() => setLinkModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  disabled={selectedToLink.length === 0 || linking}
                  onClick={handleConfirmLink}
                  className="px-6 py-2 bg-primary text-white font-label-md text-label-md rounded-lg shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-semibold"
                >
                  {linking ? 'Linking…' : `Link Selected (${selectedToLink.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
