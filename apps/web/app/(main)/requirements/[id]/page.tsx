'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchApi,
  fetchCurrentUser,
  fetchProjects,
  fetchJiraStatus,
  fetchRequirementById,
  fetchLinkedTestCases,
  fetchAvailableTestCases,
  fetchTestSuites,
  createTestCaseFull,
  linkTestCases,
  unlinkTestCase,
  type CurrentUser,
} from '@/lib/api';
import type {
  Requirement,
  TestCase,
  TestCasePriority,
  TestCaseResult,
  TestCaseType,
  TestSuite,
  Project,
  JiraConnectionStatus,
} from '@qatrack/shared-types';
import { Sidebar } from '../../dashboard/components/Sidebar';

// ── Result & Priority Badges matching exact image specs ──────────────────────

function ResultBadge({ result }: { result: TestCaseResult }) {
  switch (result) {
    case 'PASS':
      return (
        <span className="bg-emerald-100/70 text-emerald-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          Pass
        </span>
      );
    case 'FAIL':
      return (
        <span className="bg-red-100/70 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          Fail
        </span>
      );
    case 'BLOCKED':
      return (
        <span className="bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          Blocked
        </span>
      );
    default:
      return (
        <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          Untested
        </span>
      );
  }
}

function PriorityIndicator({ priority }: { priority: TestCasePriority | string }) {
  const p = (priority || 'HIGH').toUpperCase();

  if (p === 'CRITICAL') {
    return (
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[#e05243]" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 3.5l5 6.5h-3v3H6v-3H3z" />
        </svg>
        <span className="text-[#2c3e50] font-medium text-body-sm">Critical</span>
      </div>
    );
  }

  if (p === 'HIGH') {
    return (
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[#e84c3d]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 15l-6-6-6 6" />
        </svg>
        <span className="text-[#2c3e50] font-medium text-body-sm">High</span>
      </div>
    );
  }

  if (p === 'MEDIUM') {
    return (
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-[#f39c12]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M18 11l-6-5-6 5" />
          <path d="M18 17l-6-5-6 5" />
        </svg>
        <span className="text-[#2c3e50] font-medium text-body-sm">Medium</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-[#2684ff]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M6 9l6 6 6-6" />
      </svg>
      <span className="text-[#2c3e50] font-medium text-body-sm">Low</span>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let dotColor = 'bg-blue-500';
  if (s.includes('done') || s.includes('resolved') || s.includes('closed')) {
    dotColor = 'bg-secondary';
  } else if (s.includes('progress')) {
    dotColor = 'bg-orange-500';
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      <span className="text-body-sm font-medium">{status || 'To Do'}</span>
    </div>
  );
}

// ── Main Traceability Detail Page ─────────────────────────────────────────────

export default function RequirementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reqId = params?.id as string;

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [linkedCases, setLinkedCases] = useState<TestCase[]>([]);
  const [availableCases, setAvailableCases] = useState<TestCase[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jiraStatus, setJiraStatus] = useState<JiraConnectionStatus>({ connected: false });
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [selectedRelease, setSelectedRelease] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [caseSuccessMessage, setCaseSuccessMessage] = useState<string | null>(null);

  // Table search & pagination
  const [tableSearch, setTableSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  // Link Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedToLink, setSelectedToLink] = useState<string[]>([]);
  const [linking, setLinking] = useState(false);

  // Create Test Case Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseSuiteId, setCaseSuiteId] = useState('');
  const [casePriority, setCasePriority] = useState<TestCasePriority>('MEDIUM');
  const [caseType, setCaseType] = useState<TestCaseType>('FUNCTIONAL');
  const [creatingCase, setCreatingCase] = useState(false);

  // ── Load Page Data ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!reqId) return;
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    setUser(currentUser);

    try {
      const [req, linked, available, projs, status, suitesData] = await Promise.all([
        fetchRequirementById(reqId),
        fetchLinkedTestCases(reqId),
        fetchAvailableTestCases(reqId),
        fetchProjects(),
        fetchJiraStatus(),
        fetchTestSuites(),
      ]);

      setRequirement(req);
      setLinkedCases(linked);
      setAvailableCases(available);
      setProjects(projs);
      setJiraStatus(status);
      setSuites(suitesData);
      if (projs.length > 0 && !selectedProjectKey) {
        setSelectedProjectKey(projs[0].key);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load requirement traceability details');
    } finally {
      setLoading(false);
    }
  }, [reqId, router, selectedProjectKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Sync Handler ───────────────────────────────────────────────────────────

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
      setTimeout(() => setShowSyncSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Link / Unlink Handlers ─────────────────────────────────────────────────

  const handleToggleSelectCase = (id: string) => {
    setSelectedToLink((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleConfirmLink = async () => {
    if (!selectedToLink.length || !requirement) return;
    setLinking(true);
    try {
      await linkTestCases(requirement.id, selectedToLink);
      setIsModalOpen(false);
      setSelectedToLink([]);
      setModalSearch('');
      await loadData();
      setCaseSuccessMessage(`Linked ${selectedToLink.length} test case(s) successfully!`);
      setTimeout(() => setCaseSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to link test cases');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (testCaseId: string) => {
    if (!requirement) return;
    try {
      await unlinkTestCase(requirement.id, testCaseId);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to unlink test case');
    }
  };

  // ── Create Test Case Modal Handlers ────────────────────────────────────────

  const handleOpenCreateModal = () => {
    if (!requirement) return;
    setCaseTitle(`Validate ${requirement.title}`);
    setCaseSuiteId('');
    setCasePriority('MEDIUM');
    setCaseType('FUNCTIONAL');
    setCreateModalOpen(true);
  };

  const handleSaveTestCase = async () => {
    if (!caseTitle.trim() || !requirement) return;
    setCreatingCase(true);
    setError(null);
    try {
      await createTestCaseFull({
        suiteId: caseSuiteId && caseSuiteId !== '' ? caseSuiteId : undefined,
        title: caseTitle.trim(),
        coverageJiraKey: requirement.jiraIssueKey,
        priority: casePriority,
        type: caseType,
        approvalStatus: 'DRAFT',
        version: 'v1',
      });

      await loadData();
      setCreateModalOpen(false);
      setCaseSuccessMessage(`Test case created and linked to ${requirement.jiraIssueKey}!`);
      setTimeout(() => setCaseSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create test case');
    } finally {
      setCreatingCase(false);
    }
  };

  // ── Export Handler ─────────────────────────────────────────────────────────

  const handleExportTraceability = () => {
    const cases = filteredLinkedCases.length > 0 ? filteredLinkedCases : linkedCases;
    const headers = ['Requirement ID', 'Requirement Title', 'Release', 'Test Case ID', 'Test Case Title', 'Priority', 'Last Result', 'Execution Date'];
    const rows = cases.map((tc) => [
      `"${requirement?.jiraIssueKey || reqId}"`,
      `"${(requirement?.title || '').replace(/"/g, '""')}"`,
      `"${requirement?.release || selectedRelease || 'N/A'}"`,
      `"${tc.id}"`,
      `"${(tc.title || '').replace(/"/g, '""')}"`,
      `"${tc.priority}"`,
      `"${tc.lastResult}"`,
      `"${tc.executionDate || '--'}"`,
    ]);

    if (rows.length === 0) {
      setError('No linked test cases to export.');
      return;
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `traceability-${requirement?.jiraIssueKey || reqId}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const availableReleases = useMemo(() => {
    const set = new Set<string>();
    if (requirement?.release) set.add(requirement.release);
    for (const tc of linkedCases) {
      if (tc.version && tc.version !== 'v1' && tc.version !== 'ALL') set.add(tc.version);
    }
    if (set.size === 0) {
      return ['v2.4.0 (Current)', 'v2.5.0 (Next)', 'Backlog'];
    }
    return Array.from(set);
  }, [requirement, linkedCases]);

  const filteredLinkedCases = useMemo(() => {
    let list = linkedCases;
    if (selectedRelease !== 'ALL') {
      list = list.filter((tc) => tc.version === selectedRelease || requirement?.release === selectedRelease);
    }
    if (!tableSearch) return list;
    const query = tableSearch.toLowerCase();
    return list.filter(
      (tc) =>
        tc.id.toLowerCase().includes(query) ||
        tc.title.toLowerCase().includes(query) ||
        tc.priority.toLowerCase().includes(query) ||
        tc.lastResult.toLowerCase().includes(query),
    );
  }, [linkedCases, tableSearch, selectedRelease, requirement]);

  const totalPages = Math.max(1, Math.ceil(filteredLinkedCases.length / PAGE_SIZE));
  const paginatedCases = filteredLinkedCases.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

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

  const lastSyncedTime = jiraStatus.lastSyncedAt
    ? new Date(jiraStatus.lastSyncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading traceability details…
        </div>
      </div>
    );
  }

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
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setPage(1);
                }}
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>

          </div>

          <div className="flex items-center gap-4">
            <span className="text-body-sm text-on-surface-variant hidden md:inline">
              Last synced: <span className="font-bold text-on-surface">{lastSyncedTime ? `Today at ${lastSyncedTime}` : '5 mins ago'}</span>
            </span>
            <button
              onClick={handleSync}
              disabled={syncing || (!selectedProjectKey && projects.length === 0)}
              className="flex items-center gap-2 px-4 py-1.5 border border-primary text-primary rounded-lg font-semibold text-body-sm hover:bg-primary/5 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${syncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              {syncing ? 'Syncing…' : 'Sync with Jira'}
            </button>

            <div className="flex items-center gap-1 border-l border-outline-variant pl-4">
              <button
                title="Notifications"
                className="p-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button
                title="Settings"
                className="p-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
              <button
                title="Help"
                className="p-2 text-on-surface-variant hover:text-primary transition-colors active:scale-95 rounded-full hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined">help_outline</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Content Area ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface p-gutter">
          <div className="max-w-6xl mx-auto py-8 px-6">
            {/* Green Synced Banner */}
            {showSyncSuccess && (
              <div className="mb-6 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between animate-fade-in transition-all">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    check_circle
                  </span>
                  <p className="text-body-sm text-on-secondary-container">
                    Last synced with Jira:{' '}
                    <span className="font-bold">
                      {lastSyncedTime ? `Today at ${lastSyncedTime}` : 'Just now'}
                    </span>
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

            {caseSuccessMessage && (
              <div className="mb-6 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between animate-fade-in transition-all">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                  <p className="text-body-sm text-on-secondary-container font-semibold">{caseSuccessMessage}</p>
                </div>
                <button
                  onClick={() => setCaseSuccessMessage(null)}
                  className="text-on-secondary-container/70 hover:text-on-secondary-container p-1"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {error && (
              <div className="mb-6 p-3 bg-error-container border border-error rounded-lg flex items-center gap-2 text-body-sm text-on-error-container">
                <span className="material-symbols-outlined text-error text-[18px]">error</span>
                {error}
              </div>
            )}

            {/* Breadcrumbs matching image */}
            <div className="flex items-center gap-2 text-label-sm font-label-sm text-on-surface-variant mb-6">
              <Link href="/requirements" className="hover:text-primary transition-colors">
                Requirements
              </Link>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              <span className="text-on-surface font-semibold">
                {requirement?.jiraIssueKey || reqId}
              </span>
            </div>

            {/* Requirement Header Section matching image */}
            <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6 bg-white p-6 rounded-xl border border-outline-variant/40 shadow-sm">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-label-sm text-label-sm font-semibold">
                    {requirement?.type || 'Functional'}
                  </span>
                  <span className="flex items-center gap-1 text-primary font-label-md text-label-md font-semibold">
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    {requirement?.jiraIssueKey}
                  </span>
                </div>
                <h2 className="font-bold text-2xl md:text-3xl text-on-surface mb-2 tracking-tight">
                  {requirement?.title}
                </h2>
                <div className="mt-3">
                  <div className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1 opacity-75">
                    DESCRIPTION
                  </div>
                  <p className="text-on-surface-variant font-body-md text-body-md max-w-2xl leading-relaxed">
                    {requirement?.description ||
                      requirement?.title ||
                      'No description provided for this requirement.'}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant opacity-60 mb-1">
                      JIRA STATUS
                    </span>
                    <StatusIndicator status={requirement?.status || 'To Do'} />
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant opacity-60 mb-1">
                      ASSIGNEE
                    </span>
                    <span className="text-body-sm font-medium text-on-surface">
                      {requirement?.assignee || user?.name || 'Sarah Miller'}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant opacity-60 mb-1">
                      PRIORITY
                    </span>
                    <PriorityIndicator priority={requirement?.priority || 'High'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Linked Test Cases Container matching image */}
            <div className="bg-white border border-outline-variant/50 rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant/30 flex flex-wrap justify-between items-center bg-white gap-4">
                <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                  Linked Test Cases ({filteredLinkedCases.length}
                  {filteredLinkedCases.length !== linkedCases.length && (
                    <span className="text-on-surface-variant font-normal text-sm ml-1">of {linkedCases.length}</span>
                  )}
                  )
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportTraceability}
                    disabled={linkedCases.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant rounded-lg font-semibold text-body-sm text-on-surface-variant hover:bg-surface-container-low transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Export Traceability
                  </button>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-3.5 py-1.5 border border-primary text-primary rounded-lg font-semibold text-body-sm hover:bg-primary/5 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Link Test Case
                  </button>
                  <button
                    onClick={handleOpenCreateModal}
                    className="flex items-center gap-2 px-3.5 py-1.5 border border-primary text-primary rounded-lg font-semibold text-body-sm hover:bg-primary/5 transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Create Test Case
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant/30">
                    <tr>
                      <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase">
                        ID
                      </th>
                      <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Title
                      </th>
                      <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Priority
                      </th>
                      <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Last Result
                      </th>
                      <th className="px-6 py-3 font-label-sm text-label-sm text-on-surface-variant uppercase">
                        Execution Date
                      </th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-body-sm text-body-sm">
                    {paginatedCases.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-[40px] block mb-2 opacity-50">
                            assignment_late
                          </span>
                          {linkedCases.length === 0
                            ? 'No test cases linked to this requirement yet. Click "Link Test Case" above to link one.'
                            : tableSearch
                              ? 'No test cases match your search.'
                              : selectedRelease !== 'ALL'
                                ? `No test cases for release "${selectedRelease}". Try selecting "All Releases".`
                                : 'No test cases match your filters.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedCases.map((tc) => (
                        <tr
                          key={tc.id}
                          className="hover:bg-surface-container-low/30 transition-colors group"
                        >
                          <td className="px-6 py-3 font-semibold text-primary">{tc.id}</td>
                          <td className="px-6 py-3 font-medium text-on-surface">{tc.title}</td>
                          <td className="px-6 py-3">
                            <PriorityIndicator priority={tc.priority} />
                          </td>
                          <td className="px-6 py-3">
                            <ResultBadge result={tc.lastResult} />
                          </td>
                          <td className="px-6 py-3 text-on-surface-variant">
                            {tc.executionDate || '--'}
                          </td>
                          <td className="px-6 py-3 text-right space-x-2">
                            <button
                              onClick={() => handleUnlink(tc.id)}
                              title="Unlink test case"
                              className="p-1 text-on-surface-variant hover:text-error transition-all opacity-0 group-hover:opacity-100"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                link_off
                              </span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="px-6 py-3 bg-surface-container-low/30 border-t border-outline-variant/30 flex justify-between items-center">
                <p className="font-label-sm text-label-sm text-on-surface-variant">
                  Showing {filteredLinkedCases.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, filteredLinkedCases.length)} of {filteredLinkedCases.length} test cases
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded hover:bg-surface-container-low disabled:opacity-30 text-on-surface-variant cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded hover:bg-surface-container-low disabled:opacity-30 text-on-surface-variant cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Searchable Modal Picker ── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-fade-in">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold">Link Test Cases</h3>
                  <p className="text-label-sm font-label-sm text-on-surface-variant">
                    Select cases to link with {requirement?.jiraIssueKey || reqId}
                  </p>
                </div>
                <button
                  className="p-2 hover:bg-surface-container-low rounded-full transition-colors cursor-pointer"
                  onClick={() => setIsModalOpen(false)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
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
                          onClick={() => handleToggleSelectCase(tc.id)}
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

              <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex justify-end gap-3">
                <button
                  className="px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors cursor-pointer"
                  onClick={() => setIsModalOpen(false)}
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

        {/* ── Create Test Case Modal ── */}
        {createModalOpen && requirement && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in">
              <div className="p-6 border-b border-outline-variant flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Create Test Case</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Linking coverage to <span className="font-bold text-primary">{requirement.jiraIssueKey}</span>
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
                    value={requirement.jiraIssueKey}
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
      </main>
    </div>
  );
}
