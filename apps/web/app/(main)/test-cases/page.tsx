'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchApi,
  fetchCurrentUser,
  fetchProjects,
  fetchJiraStatus,
  fetchRequirements,
  fetchTestSuites,
  createTestSuite,
  createTestCaseFull,
  updateTestCase,
  deleteTestCase,
  type CurrentUser,
} from '@/lib/api';
import type {
  TestSuite,
  TestCase,
  Requirement,
  TestCasePriority,
  TestCaseResult,
  TestApprovalStatus,
  TestCaseType,
  Project,
  JiraConnectionStatus,
} from '@qatrack/shared-types';
import { Sidebar } from '../dashboard/components/Sidebar';

// ── Badges ───────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TestCasePriority }) {
  switch (priority) {
    case 'CRITICAL':
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-error border border-red-100 uppercase tracking-tighter">
          L1 - CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-warning border border-orange-100 uppercase tracking-tighter">
          L2 - HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-primary border border-blue-100 uppercase tracking-tighter">
          L3 - MEDIUM
        </span>
      );
    default:
      return (
        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-neutral border border-outline uppercase tracking-tighter">
          L4 - LOW
        </span>
      );
  }
}

function ApprovalBadge({ status }: { status?: TestApprovalStatus }) {
  switch (status) {
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-secondary border border-green-200">
          <span className="material-symbols-outlined text-[12px]">check_circle</span> Approved
        </span>
      );
    case 'IN_REVIEW':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-primary border border-blue-100">
          <span className="material-symbols-outlined text-[12px]">clinical_notes</span> In Review
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-error border border-red-200">
          <span className="material-symbols-outlined text-[12px]">cancel</span> Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-neutral border border-outline">
          <span className="material-symbols-outlined text-[12px]">draw</span> Draft
        </span>
      );
  }
}

function ExecutionBadge({ result }: { result: TestCaseResult }) {
  switch (result) {
    case 'PASS':
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-white text-[10px] font-bold uppercase tracking-wider">
          PASS
        </div>
      );
    case 'FAIL':
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error text-white text-[10px] font-bold uppercase tracking-wider">
          FAIL
        </div>
      );
    case 'BLOCKED':
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning text-white text-[10px] font-bold uppercase tracking-wider">
          BLOCKED
        </div>
      );
    default:
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral text-white text-[10px] font-bold uppercase tracking-wider">
          NOT RUN
        </div>
      );
  }
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function TestCasesPage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jiraStatus, setJiraStatus] = useState<JiraConnectionStatus>({ connected: false });
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [selectedRelease, setSelectedRelease] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Filters & State
  const [search, setSearch] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [currentRole, setCurrentRole] = useState<'QA Lead' | 'Tester' | 'PO' | 'Developer' | 'Viewer'>('QA Lead');

  // Collapsed Suites
  const [collapsedSuites, setCollapsedSuites] = useState<Record<string, boolean>>({});

  // Modals
  const [isSuiteModalOpen, setIsSuiteModalOpen] = useState(false);
  const [newSuiteTitle, setNewSuiteTitle] = useState('');
  const [newSuiteDesc, setNewSuiteDesc] = useState('');

  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);
  const [caseSuiteId, setCaseSuiteId] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [caseCoverageKey, setCaseCoverageKey] = useState('');
  const [casePriority, setCasePriority] = useState<TestCasePriority>('MEDIUM');
  const [caseType, setCaseType] = useState<TestCaseType>('FUNCTIONAL');

  // Import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  // Role visibility permissions
  const canEdit = currentRole !== 'Developer' && currentRole !== 'Viewer';

  // ── Dynamic Releases ───────────────────────────────────────────────────────

  const availableReleases = useMemo(() => {
    const set = new Set<string>();
    for (const s of suites) {
      if (s.release && s.release !== 'Unassigned' && s.release !== 'ALL') set.add(s.release);
      for (const tc of s.testCases) {
        if (tc.version && tc.version !== 'v1' && tc.version !== 'ALL') set.add(tc.version);
      }
    }
    for (const r of requirements) {
      if (r.release) set.add(r.release);
    }
    if (set.size === 0) {
      return ['v2.4.0 (Current)', 'v2.5.0 (Next)', 'Backlog'];
    }
    return Array.from(set);
  }, [suites, requirements]);

  // ── Load Data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    setUser(currentUser);

    try {
      const [suitesData, projs, status, reqs] = await Promise.all([
        fetchTestSuites(),
        fetchProjects(),
        fetchJiraStatus(),
        fetchRequirements().catch(() => []),
      ]);

      setSuites(suitesData);
      setProjects(projs);
      setJiraStatus(status);
      setRequirements(reqs);
      if (projs.length > 0 && !selectedProjectKey) {
        setSelectedProjectKey(projs[0].key);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load test suites');
    } finally {
      setLoading(false);
    }
  }, [router, selectedProjectKey]);

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

  // ── Toggle Suite Collapse ──────────────────────────────────────────────────

  const toggleSuite = (suiteId: string) => {
    setCollapsedSuites((prev) => ({
      ...prev,
      [suiteId]: !prev[suiteId],
    }));
  };

  // ── Create Suite ───────────────────────────────────────────────────────────

  const handleCreateSuite = async () => {
    if (!newSuiteTitle.trim()) return;
    try {
      const created = await createTestSuite({
        title: newSuiteTitle,
        description: newSuiteDesc,
        release: selectedRelease,
      });
      setSuites((prev) => [...prev, created]);
      setIsSuiteModalOpen(false);
      setNewSuiteTitle('');
      setNewSuiteDesc('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create suite');
    }
  };

  // ── Create Test Case ───────────────────────────────────────────────────────

  const handleCreateTestCase = async () => {
    if (!caseTitle.trim()) return;
    try {
      const targetSuiteId = caseSuiteId && caseSuiteId !== '' ? caseSuiteId : undefined;
      const created = await createTestCaseFull({
        suiteId: targetSuiteId,
        title: caseTitle,
        coverageJiraKey: caseCoverageKey || undefined,
        priority: casePriority,
        type: caseType,
        approvalStatus: currentRole === 'QA Lead' ? 'APPROVED' : 'IN_REVIEW',
        version: 'v1',
      });

      // Reload full data to ensure clean presentation of suites and standalone cases
      await loadData();

      setIsCaseModalOpen(false);
      setCaseTitle('');
      setCaseCoverageKey('');
      setCaseSuiteId('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create test case');
    }
  };

  // ── Delete Test Case ───────────────────────────────────────────────────────

  const handleDeleteTestCase = async (id: string) => {
    try {
      await deleteTestCase(id);
      setSuites((prev) =>
        prev.map((s) => ({
          ...s,
          testCases: s.testCases.filter((tc) => tc.id !== id),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to delete test case');
    }
  };

  // ── Cycle Result (Quick Status Update) ─────────────────────────────────────

  const handleCycleResult = async (tc: TestCase) => {
    const nextResult: Record<TestCaseResult, TestCaseResult> = {
      PASS: 'FAIL',
      FAIL: 'BLOCKED',
      BLOCKED: 'UNTESTED',
      UNTESTED: 'PASS',
    };
    const updatedRes = nextResult[tc.lastResult];
    try {
      await updateTestCase(tc.id, { lastResult: updatedRes });
      setSuites((prev) =>
        prev.map((s) => ({
          ...s,
          testCases: s.testCases.map((t) =>
            t.id === tc.id ? { ...t, lastResult: updatedRes } : t,
          ),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update result');
    }
  };

  // ── Export Test Cases ──────────────────────────────────────────────────────

  const handleExport = () => {
    const allCases = filteredSuites.flatMap((suite) =>
      suite.testCases.map((tc) => ({
        ...tc,
        suiteName: suite.title,
        suiteRelease: suite.release || '',
      })),
    );

    if (allCases.length === 0) {
      setError('No test cases to export.');
      return;
    }

    const headers = [
      'ID', 'Suite', 'Release', 'Title', 'Coverage Jira Key',
      'Priority', 'Type', 'Approval Status', 'Version', 'Last Result', 'Updated At',
    ];
    const rows = allCases.map((tc: any) => [
      `"${tc.id}"`,
      `"${tc.suiteName.replace(/"/g, '""')}"`,
      `"${tc.suiteRelease}"`,
      `"${(tc.title || '').replace(/"/g, '""')}"`,
      `"${tc.coverageJiraKey || ''}"`,
      `"${tc.priority || ''}"`,
      `"${tc.type || ''}"`,
      `"${tc.approvalStatus || ''}"`,
      `"${tc.version || ''}"`,
      `"${tc.lastResult || ''}"`,
      `"${tc.updatedAt || ''}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `test-cases-${selectedProjectKey || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Import Test Cases ──────────────────────────────────────────────────────

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-imported
    e.target.value = '';

    setImportProgress(null);
    setImporting(true);
    setIsImportModalOpen(true);

    try {
      const text = await file.text();
      let rows: Array<{ title: string; priority?: string; type?: string; coverageJiraKey?: string; version?: string; suiteId?: string }> = [];

      if (file.name.endsWith('.json')) {
        // JSON array of objects
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        // CSV — first row is headers
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) throw new Error('CSV has no data rows.');
        const rawHeaders = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());

        const col = (row: string[], name: string) => {
          const idx = rawHeaders.indexOf(name);
          return idx >= 0 ? row[idx]?.replace(/^"|"$/g, '').trim() : '';
        };

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? lines[i].split(',');
          const title = col(cells, 'title') || col(cells, 'name') || col(cells, 'test case');
          if (!title) continue;
          rows.push({
            title,
            priority: col(cells, 'priority') || 'MEDIUM',
            type: col(cells, 'type') || 'FUNCTIONAL',
            coverageJiraKey: col(cells, 'coverage jira key') || col(cells, 'jira key') || col(cells, 'jirakey'),
            version: col(cells, 'version') || 'v1',
          });
        }
      }

      if (rows.length === 0) throw new Error('No valid rows found in the file.');

      const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const validTypes = ['SMOKE', 'REGRESSION', 'FUNCTIONAL', 'PERFORMANCE', 'SECURITY'];

      const errors: string[] = [];
      let done = 0;
      setImportProgress({ done: 0, total: rows.length, errors: [] });

      for (const row of rows) {
        try {
          await createTestCaseFull({
            title: row.title,
            priority: (validPriorities.includes((row.priority || '').toUpperCase())
              ? row.priority!.toUpperCase()
              : 'MEDIUM') as TestCasePriority,
            type: (validTypes.includes((row.type || '').toUpperCase())
              ? row.type!.toUpperCase()
              : 'FUNCTIONAL') as TestCaseType,
            coverageJiraKey: row.coverageJiraKey || undefined,
            version: row.version || 'v1',
            approvalStatus: 'DRAFT',
          });
          done++;
          setImportProgress((prev) => ({ ...prev!, done }));
        } catch (err: any) {
          errors.push(`Row "${row.title}": ${err?.message || 'Unknown error'}`);
          setImportProgress((prev) => ({ ...prev!, errors: [...(prev?.errors ?? []), `"${row.title}": ${err?.message}`] }));
        }
      }

      // Reload suites
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Import failed');
      setIsImportModalOpen(false);
    } finally {
      setImporting(false);
    }
  };

  // ── Filtered Suites & Cases ────────────────────────────────────────────────

  const filteredSuites = useMemo(() => {
    return suites
      .filter((suite) => {
        if (selectedRelease !== 'ALL') {
          const suiteMatches = suite.release === selectedRelease;
          const hasMatchingCase = suite.testCases.some((tc) => {
            if (tc.version === selectedRelease) return true;
            if (tc.coverageJiraKey) {
              const req = requirements.find((r) => r.jiraIssueKey === tc.coverageJiraKey);
              if (req?.release === selectedRelease) return true;
            }
            return false;
          });
          if (!suiteMatches && !hasMatchingCase) return false;
        }
        return true;
      })
      .map((suite) => {
        const filteredCases = suite.testCases.filter((tc) => {
          // Release filter
          if (selectedRelease !== 'ALL' && suite.release !== selectedRelease) {
            const caseMatches = tc.version === selectedRelease;
            const reqMatches =
              tc.coverageJiraKey &&
              requirements.find((r) => r.jiraIssueKey === tc.coverageJiraKey)?.release ===
                selectedRelease;
            if (!caseMatches && !reqMatches) return false;
          }
          // Search filter
          if (search) {
            const q = search.toLowerCase();
            const matchesTitle = tc.title.toLowerCase().includes(q);
            const matchesId = tc.id.toLowerCase().includes(q);
            const matchesKey = tc.coverageJiraKey?.toLowerCase().includes(q);
            if (!matchesTitle && !matchesId && !matchesKey) return false;
          }
          // Priority filter
          if (selectedLevel !== 'All' && tc.priority !== selectedLevel) {
            return false;
          }
          // Type filter
          if (selectedType !== 'All' && tc.type !== selectedType) {
            return false;
          }
          return true;
        });

        return {
          ...suite,
          testCases: filteredCases,
        };
      });
  }, [suites, requirements, search, selectedLevel, selectedType, selectedRelease]);

  // ── Overall Stats ──────────────────────────────────────────────────────────

  const allTestCases = useMemo(
    () => filteredSuites.flatMap((s) => s.testCases),
    [filteredSuites],
  );

  const stats = useMemo(() => {
    const pass = allTestCases.filter((t) => t.lastResult === 'PASS').length;
    const fail = allTestCases.filter((t) => t.lastResult === 'FAIL').length;
    const blocked = allTestCases.filter((t) => t.lastResult === 'BLOCKED').length;
    const notRun = allTestCases.filter((t) => t.lastResult === 'UNTESTED').length;
    return { pass, fail, blocked, notRun, total: allTestCases.length };
  }, [allTestCases]);

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
          Loading test cases…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-on-surface font-body-md overflow-hidden">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] relative overflow-hidden">
        {/* ── TopNavBar - JSON Execution ── */}
        <header className="h-14 w-full sticky top-0 z-50 bg-white border-b border-outline-variant shadow-sm flex justify-between items-center px-gutter gap-4 shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative w-64 md:w-80 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
                search
              </span>
              <input
                className="w-full pl-10 pr-4 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface"
                placeholder="Search test cases..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
                  value={selectedProjectKey}
                  onChange={(e) => setSelectedProjectKey(e.target.value)}
                  className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0 text-on-surface font-semibold outline-none whitespace-nowrap"
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
                  value={selectedRelease}
                  onChange={(e) => setSelectedRelease(e.target.value)}
                  className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0 text-on-surface font-semibold outline-none whitespace-nowrap"
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
            <span className="text-body-xs text-on-surface-variant text-[11px] hidden sm:inline">
              Last synced: <span className="font-semibold">{lastSyncedTime || 'Never'}</span>
            </span>

            {/* Outlined Sync Button matching Dashboard and Requirements */}
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

            <div className="h-6 w-[1px] bg-outline-variant mx-1"></div>

            <div className="flex items-center gap-1">
              <button
                title="Notifications"
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button
                title="Settings"
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
              <button
                title="Help"
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined">help_outline</span>
              </button>
            </div>
          </div>
        </header>

        {/* Green Synced Banner */}
        {showSyncSuccess && (
          <div className="mx-gutter mt-4 p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between animate-fade-in transition-all">
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
              className="text-on-secondary-container/70 hover:text-on-secondary-container p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* ── Filter & Action Bar ── */}
        <div className="bg-white border-b border-outline-variant px-gutter py-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral">Filter by:</span>
              <div className="flex gap-2">
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-outline-variant/60 rounded-md text-xs font-medium cursor-pointer focus:ring-1 focus:ring-primary"
                >
                  <option value="All">All Levels</option>
                  <option value="CRITICAL">L1 - Critical</option>
                  <option value="HIGH">L2 - High</option>
                  <option value="MEDIUM">L3 - Medium</option>
                  <option value="LOW">L4 - Low</option>
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-outline-variant/60 rounded-md text-xs font-medium cursor-pointer focus:ring-1 focus:ring-primary"
                >
                  <option value="All">All Types</option>
                  <option value="SMOKE">Smoke</option>
                  <option value="REGRESSION">Regression</option>
                  <option value="FUNCTIONAL">Functional</option>
                  <option value="PERFORMANCE">Performance</option>
                  <option value="SECURITY">Security</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex border border-outline-variant/60 rounded-md overflow-hidden bg-white">
              {/* Hidden file input for import */}
              <input
                id="tc-import-input"
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                onClick={() => document.getElementById('tc-import-input')?.click()}
                className="px-3 py-2 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 border-r border-outline-variant/60 cursor-pointer transition-colors"
                title="Import test cases from CSV or JSON"
              >
                <span className="material-symbols-outlined text-lg">upload</span> Import
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-2 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Export visible test cases as CSV"
              >
                <span className="material-symbols-outlined text-lg">download</span> Export
              </button>
            </div>

            {canEdit && (
              <div className="flex gap-3">
                <button
                  onClick={() => setIsSuiteModalOpen(true)}
                  className="px-4 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant font-label-md text-label-md hover:bg-surface-container-low transition-all active:scale-95 flex items-center gap-2 h-[34px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
                  New Suite
                </button>
                <button
                  onClick={() => {
                    setCaseSuiteId('');
                    setIsCaseModalOpen(true);
                  }}
                  className="px-4 py-1.5 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 h-[34px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Create Test Case
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable Content Area ── */}
        <div className="flex-1 overflow-auto p-gutter bg-[#F9FAFB] space-y-gutter custom-scrollbar">
          {error && (
            <div className="p-3 bg-error-container border border-error rounded-lg flex items-center gap-2 text-body-sm text-on-error-container">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              {error}
            </div>
          )}

          {filteredSuites.length === 0 ? (
            <div className="bg-white border border-outline-variant/60 rounded-xl p-12 text-center text-on-surface-variant shadow-sm">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_off</span>
              <p className="font-bold text-sm">No test suites created yet</p>
              <p className="text-xs text-neutral mt-1">
                {canEdit
                  ? 'Click "New Suite" above or create a test case to get started.'
                  : 'No test suites match the selected filters.'}
              </p>
            </div>
          ) : (
            filteredSuites.map((suite) => {
              const isCollapsed = collapsedSuites[suite.id] || false;
              const totalCount = suite.testCases.length;
              const passCount = suite.testCases.filter((t) => t.lastResult === 'PASS').length;
              const failCount = suite.testCases.filter((t) => t.lastResult === 'FAIL').length;
              const blockedCount = suite.testCases.filter((t) => t.lastResult === 'BLOCKED').length;
              const notRunCount = suite.testCases.filter((t) => t.lastResult === 'UNTESTED').length;

              const passPct = totalCount ? Math.round((passCount / totalCount) * 100) : 0;
              const failPct = totalCount ? Math.round((failCount / totalCount) * 100) : 0;
              const blockedPct = totalCount ? Math.round((blockedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={suite.id}
                  className="bg-white border border-outline-variant/60 rounded-xl shadow-sm overflow-hidden"
                >
                  {/* Suite Header */}
                  <div
                    onClick={() => toggleSuite(suite.id)}
                    className="px-6 py-4 bg-white border-b border-outline-variant/60 flex items-center justify-between group cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <span className="material-symbols-outlined text-primary">
                        {isCollapsed ? 'folder' : 'folder_open'}
                      </span>
                      <div>
                        <h3 className="font-bold text-on-surface flex items-center gap-2">
                          {suite.title}
                          {suite.release && (
                            <span className="text-[10px] bg-blue-50 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter">
                              {suite.release}
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-neutral mt-0.5">{suite.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-secondary"></span> {passCount}{' '}
                          <span className="text-neutral font-normal">Pass</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-error"></span> {failCount}{' '}
                          <span className="text-neutral font-normal">Fail</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-warning"></span> {blockedCount}{' '}
                          <span className="text-neutral font-normal">Blocked</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-neutral"></span> {notRunCount}{' '}
                          <span className="text-neutral font-normal">Not Run</span>
                        </div>
                      </div>

                      <div className="w-32 flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-secondary">Progress</span>
                          <span className="text-on-surface">{passPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-secondary" style={{ width: `${passPct}%` }}></div>
                          <div className="h-full bg-error" style={{ width: `${failPct}%` }}></div>
                          <div className="h-full bg-warning" style={{ width: `${blockedPct}%` }}></div>
                        </div>
                      </div>

                      <span
                        className={`material-symbols-outlined text-neutral transition-transform ${
                          isCollapsed ? '' : 'rotate-90'
                        }`}
                      >
                        chevron_right
                      </span>
                    </div>
                  </div>

                  {/* Suite Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-outline-variant/60">
                          <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider w-24">
                              ID
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider">
                              Title &amp; Coverage
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider w-24 text-center">
                              Priority
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider w-28 text-center">
                              Type
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider w-32 text-center">
                              Approval
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider w-24 text-center">
                              Version
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-neutral uppercase tracking-wider w-32 text-center">
                              Execution
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/40">
                          {suite.testCases.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-6 py-8 text-center text-xs text-neutral"
                              >
                                No test cases in this suite. Click "Create Test Case" to add one.
                              </td>
                            </tr>
                          ) : (
                            suite.testCases.map((tc) => (
                              <tr key={tc.id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-6 py-4 font-mono text-xs text-primary font-bold">
                                  {tc.id}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-on-surface">{tc.title}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {tc.coverageJiraKey && (
                                      <span className="text-[10px] font-medium text-neutral flex items-center gap-0.5">
                                        <span className="material-symbols-outlined text-xs">link</span>{' '}
                                        {tc.coverageJiraKey}
                                      </span>
                                    )}
                                    {tc.coverageJiraKey && <span className="text-[10px] text-neutral">•</span>}
                                    <span className="text-[10px] text-neutral">
                                      Updated {tc.updatedAt || 'recently'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <PriorityBadge priority={tc.priority} />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-neutral border border-outline uppercase">
                                    {tc.type || 'FUNCTIONAL'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <ApprovalBadge status={tc.approvalStatus} />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-on-surface-variant">
                                    {tc.version || 'v1'}{' '}
                                    <span
                                      className="material-symbols-outlined text-sm cursor-help hover:text-primary transition-colors"
                                      title="Version History"
                                    >
                                      history
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    onClick={() => handleCycleResult(tc)}
                                    title="Click to toggle status"
                                    className="cursor-pointer hover:opacity-90 active:scale-95 transition-transform"
                                  >
                                    <ExecutionBadge result={tc.lastResult} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer Stats ── */}
        <footer className="h-10 bg-white border-t border-outline-variant/60 flex items-center justify-between px-gutter shrink-0">
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-neutral">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-secondary rounded-sm"></span> {stats.pass} Passed
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-error rounded-sm"></span> {stats.fail} Failed
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-warning rounded-sm"></span> {stats.blocked} Blocked
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-neutral rounded-sm"></span> {stats.notRun} Not Run
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
            <span>Showing {allTestCases.length} Test Cases</span>
          </div>
        </footer>
      </main>

      {/* ── Create Suite Modal ── */}
      {isSuiteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-outline flex items-center justify-between">
              <h2 className="text-lg font-bold">Create New Test Suite</h2>
              <button
                className="text-neutral hover:text-on-surface"
                onClick={() => setIsSuiteModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Suite Title
                </label>
                <input
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                  placeholder="e.g. Navigation Header & Footer"
                  type="text"
                  value={newSuiteTitle}
                  onChange={(e) => setNewSuiteTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Suite Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm h-24 resize-none"
                  placeholder="Explain the coverage area..."
                  value={newSuiteDesc}
                  onChange={(e) => setNewSuiteDesc(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors"
                onClick={() => setIsSuiteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSuite}
                className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Suite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Test Case Modal ── */}
      {isCaseModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-outline flex items-center justify-between">
              <h2 className="text-lg font-bold">Create New Test Case</h2>
              <button
                className="text-neutral hover:text-on-surface"
                onClick={() => setIsCaseModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Select Suite (Optional)
                </label>
                <select
                  value={caseSuiteId}
                  onChange={(e) => setCaseSuiteId(e.target.value)}
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
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
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Test Case Title
                </label>
                <input
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                  placeholder="e.g. Guest checkout with valid credit card"
                  type="text"
                  value={caseTitle}
                  onChange={(e) => setCaseTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Coverage Jira Key (Optional)
                </label>
                <input
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                  placeholder="e.g. STORY-882"
                  type="text"
                  value={caseCoverageKey}
                  onChange={(e) => setCaseCoverageKey(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Priority
                  </label>
                  <select
                    value={casePriority}
                    onChange={(e) => setCasePriority(e.target.value as TestCasePriority)}
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
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
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="SMOKE">Smoke</option>
                    <option value="REGRESSION">Regression</option>
                    <option value="FUNCTIONAL">Functional</option>
                    <option value="PERFORMANCE">Performance</option>
                    <option value="SECURITY">Security</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors"
                onClick={() => setIsCaseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTestCase}
                className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Test Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Progress Modal ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="p-6 border-b border-outline flex items-center justify-between">
              <div className="flex items-center gap-3">
                {importing ? (
                  <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                ) : (importProgress?.errors?.length ?? 0) > 0 ? (
                  <span className="material-symbols-outlined text-warning">warning</span>
                ) : (
                  <span className="material-symbols-outlined text-secondary">check_circle</span>
                )}
                <h2 className="text-base font-bold">
                  {importing ? 'Importing Test Cases…' : 'Import Complete'}
                </h2>
              </div>
              {!importing && (
                <button
                  className="text-neutral hover:text-on-surface cursor-pointer"
                  onClick={() => { setIsImportModalOpen(false); setImportProgress(null); }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {importProgress && (
                <>
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-on-surface-variant mb-2">
                      <span>{importProgress.done} of {importProgress.total} imported</span>
                      <span>{importProgress.total > 0 ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                        style={{ width: `${importProgress.total > 0 ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Success summary */}
                  {!importing && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                      importProgress.errors.length === 0
                        ? 'bg-secondary-container/20 text-on-secondary-container'
                        : 'bg-amber-50 text-amber-800'
                    }`}>
                      <span className="material-symbols-outlined text-[18px]">
                        {importProgress.errors.length === 0 ? 'task_alt' : 'info'}
                      </span>
                      {importProgress.errors.length === 0
                        ? `All ${importProgress.done} test case${importProgress.done !== 1 ? 's' : ''} imported successfully.`
                        : `${importProgress.done} imported, ${importProgress.errors.length} failed.`}
                    </div>
                  )}

                  {/* Errors list */}
                  {importProgress.errors.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                      <p className="text-xs font-bold text-neutral uppercase tracking-wider">Errors</p>
                      {importProgress.errors.map((e, i) => (
                        <div key={i} className="text-xs text-error bg-error-container/20 rounded px-2 py-1">
                          {e}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Hint while no progress yet */}
              {!importProgress && importing && (
                <p className="text-sm text-on-surface-variant">Parsing file and creating test cases…</p>
              )}
            </div>

            {!importing && (
              <div className="px-6 pb-6 flex justify-between items-center">
                <p className="text-xs text-on-surface-variant">
                  <span className="font-semibold">Tip:</span> Export CSV first to see the expected format.
                </p>
                <button
                  onClick={() => { setIsImportModalOpen(false); setImportProgress(null); }}
                  className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
