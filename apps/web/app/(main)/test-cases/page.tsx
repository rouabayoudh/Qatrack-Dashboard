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
  updateTestSuite,
  deleteTestCase,
  deleteTestSuite,
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
import { TopBar } from '../dashboard/components/TopBar';

// ── Badges Matching Exact Design Spec ────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TestCasePriority }) {
  switch (priority) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-[#e05243] border border-red-200 uppercase tracking-wider">
          L1 - CRITICAL
        </span>
      );
    case 'HIGH':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-[#d97706] border border-amber-200 uppercase tracking-wider">
          L2 - HIGH
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-[#2563eb] border border-blue-200 uppercase tracking-wider">
          L3 - MEDIUM
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider">
          L4 - LOW
        </span>
      );
  }
}

function ApprovalBadge({ status }: { status?: TestApprovalStatus }) {
  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
        <span className="material-symbols-outlined text-[14px]">check_circle</span> Approved
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-2xl bg-gray-100/90 border border-gray-200 text-center">
      <div className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700">
        <span className="material-symbols-outlined text-[14px] text-gray-500">schedule</span>
        Not Approved Yet
      </div>
      <span className="text-[10px] text-gray-400 font-normal mt-0.5">Excluded from metrics</span>
    </div>
  );
}

function ExecutionBadge({ result }: { result: TestCaseResult }) {
  switch (result) {
    case 'PASS':
      return (
        <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-[#10b981] text-white text-xs font-bold uppercase tracking-wider shadow-2xs">
          PASS
        </div>
      );
    case 'FAIL':
      return (
        <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-[#ef4444] text-white text-xs font-bold uppercase tracking-wider shadow-2xs">
          FAIL
        </div>
      );
    case 'BLOCKED':
      return (
        <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-[#d97706] text-white text-xs font-bold uppercase tracking-wider shadow-2xs">
          BLOCKED
        </div>
      );
    default:
      return (
        <div className="inline-flex items-center justify-center px-3.5 py-1 rounded-full bg-[#6b7280] text-white text-xs font-bold uppercase tracking-wider shadow-2xs">
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

  // Editing Modals
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);

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

  // ── Update Suite (calls real API + updates local state) ───────────────────

  const handleSaveEditSuite = async () => {
    if (!editingSuite) return;
    try {
      const updated = await updateTestSuite(editingSuite.id, {
        title: editingSuite.title,
        description: editingSuite.description,
        release: editingSuite.release,
        productModule: editingSuite.productModule,
        requireApproval: editingSuite.requireApproval,
        excludeUnapproved: editingSuite.excludeUnapproved,
        executionStrategy: editingSuite.executionStrategy,
      });
      setSuites((prev) =>
        prev.map((s) => (s.id === editingSuite.id ? { ...s, ...updated } : s)),
      );
      setEditingSuite(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update suite');
    }
  };

  // ── Delete Suite (calls real API + removes from local state) ──────────────

  const handleDeleteSuite = async (suiteId: string) => {
    try {
      await deleteTestSuite(suiteId);
      setSuites((prev) => prev.filter((s) => s.id !== suiteId));
      setEditingSuite(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete suite');
    }
  };

  // ── Create Test Case ───────────────────────────────────────────────────────

  const handleCreateTestCase = async () => {
    if (!caseTitle.trim()) return;
    try {
      const targetSuiteId = caseSuiteId && caseSuiteId !== '' ? caseSuiteId : undefined;
      await createTestCaseFull({
        suiteId: targetSuiteId,
        title: caseTitle,
        coverageJiraKey: caseCoverageKey || undefined,
        priority: casePriority,
        type: caseType,
        approvalStatus: currentRole === 'QA Lead' ? 'APPROVED' : 'DRAFT',
        version: 'v1',
      });

      await loadData();

      setIsCaseModalOpen(false);
      setCaseTitle('');
      setCaseCoverageKey('');
      setCaseSuiteId('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create test case');
    }
  };

  // ── Update Test Case ───────────────────────────────────────────────────────

  const handleSaveEditCase = async () => {
    if (!editingCase) return;
    try {
      await updateTestCase(editingCase.id, {
        title: editingCase.title,
        coverageJiraKey: editingCase.coverageJiraKey,
        priority: editingCase.priority,
        type: editingCase.type,
        approvalStatus: editingCase.approvalStatus,
        lastResult: editingCase.lastResult,
        version: editingCase.version,
      });

      setSuites((prev) =>
        prev.map((s) => ({
          ...s,
          testCases: s.testCases.map((tc) => (tc.id === editingCase.id ? { ...tc, ...editingCase } : tc)),
        })),
      );
      setEditingCase(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update test case');
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

    e.target.value = '';
    setImportProgress(null);
    setImporting(true);
    setIsImportModalOpen(true);

    try {
      const text = await file.text();
      let rows: Array<{ title: string; priority?: string; type?: string; coverageJiraKey?: string; version?: string }> = [];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [parsed];
      } else {
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
          if (selectedRelease !== 'ALL' && suite.release !== selectedRelease) {
            const caseMatches = tc.version === selectedRelease;
            const reqMatches =
              tc.coverageJiraKey &&
              requirements.find((r) => r.jiraIssueKey === tc.coverageJiraKey)?.release ===
                selectedRelease;
            if (!caseMatches && !reqMatches) return false;
          }
          if (search) {
            const q = search.toLowerCase();
            const matchesTitle = tc.title.toLowerCase().includes(q);
            const matchesId = tc.id.toLowerCase().includes(q);
            const matchesKey = tc.coverageJiraKey?.toLowerCase().includes(q);
            if (!matchesTitle && !matchesId && !matchesKey) return false;
          }
          if (selectedLevel !== 'All' && tc.priority !== selectedLevel) {
            return false;
          }
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
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
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
        {/* Functional TopBar with working notifications, settings & help */}
        <TopBar
          projects={projects}
          selectedProjectKey={selectedProjectKey}
          onProjectChange={setSelectedProjectKey}
          syncing={syncing}
          onSync={handleSync}
        />

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
                  value={selectedRelease}
                  onChange={(e) => setSelectedRelease(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-outline-variant/60 rounded-md text-xs font-medium cursor-pointer focus:ring-1 focus:ring-primary text-gray-700"
                >
                  <option value="ALL">All Releases</option>
                  {availableReleases.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-outline-variant/60 rounded-md text-xs font-medium cursor-pointer focus:ring-1 focus:ring-primary text-gray-700"
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
                  className="px-3 py-1.5 bg-gray-50 border border-outline-variant/60 rounded-md text-xs font-medium cursor-pointer focus:ring-1 focus:ring-primary text-gray-700"
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
              <input
                id="tc-import-input"
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                onClick={() => document.getElementById('tc-import-input')?.click()}
                className="px-3 py-2 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 border-r border-outline-variant/60 cursor-pointer transition-colors text-gray-700"
                title="Import test cases from CSV or JSON"
              >
                <span className="material-symbols-outlined text-lg">upload</span> Import
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-2 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors text-gray-700"
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

              // Approval Metrics calculation matching exact user screenshot
              const approvedCases = suite.testCases.filter((t) => t.approvalStatus === 'APPROVED');
              const pendingCases = suite.testCases.filter((t) => t.approvalStatus !== 'APPROVED');

              // Display metrics for approved cases if available, otherwise total cases
              const metricCases = approvedCases.length > 0 ? approvedCases : suite.testCases;
              const passCount = metricCases.filter((t) => t.lastResult === 'PASS').length;
              const failCount = metricCases.filter((t) => t.lastResult === 'FAIL').length;
              const blockedCount = metricCases.filter((t) => t.lastResult === 'BLOCKED').length;
              const notRunCount = metricCases.filter((t) => t.lastResult === 'UNTESTED').length;
              const totalCount = metricCases.length;

              const passPct = totalCount ? Math.round((passCount / totalCount) * 100) : 0;
              const failPct = totalCount ? Math.round((failCount / totalCount) * 100) : 0;
              const blockedPct = totalCount ? Math.round((blockedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={suite.id}
                  className="bg-white border border-outline-variant/60 rounded-xl shadow-xs overflow-hidden"
                >
                  {/* Suite Header Row */}
                  <div className="px-6 py-4 bg-white border-b border-outline-variant/60 flex items-center justify-between group hover:bg-gray-50/80 transition-colors">
                    <div
                      className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                      onClick={() => toggleSuite(suite.id)}
                    >
                      <span className="material-symbols-outlined text-[#2563eb] text-2xl shrink-0">
                        {isCollapsed ? 'folder' : 'folder_open'}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface text-base flex items-center gap-2">
                          {suite.title}
                          {suite.release && (
                            <span className="text-[10px] bg-blue-50 text-primary px-2 py-0.5 rounded-full uppercase tracking-tighter font-semibold">
                              {suite.release}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-neutral mt-0.5 truncate">{suite.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      {/* Approved Only metrics bar */}
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          APPROVED ONLY:
                        </span>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                          <span className="text-gray-900">{passCount}</span>{' '}
                          <span className="text-gray-500 font-normal">Pass</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
                          <span className="text-gray-900">{failCount}</span>{' '}
                          <span className="text-gray-500 font-normal">Fail</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-2 h-2 rounded-full bg-[#d97706]"></span>
                          <span className="text-gray-900">{blockedCount}</span>{' '}
                          <span className="text-gray-500 font-normal">Blocked</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-2 h-2 rounded-full bg-[#6b7280]"></span>
                          <span className="text-gray-900">{notRunCount}</span>{' '}
                          <span className="text-gray-500 font-normal">Not Run</span>
                        </div>
                      </div>

                      {/* Excluded pending approval pill */}
                      {pendingCases.length > 0 && (
                        <span className="bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-3 py-0.5 text-xs font-medium">
                          {pendingCases.length} Excluded (Pending Approval)
                        </span>
                      )}

                      {/* Progress Approved gauge */}
                      <div className="w-36 flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-emerald-600">Progress (Approved)</span>
                          <span className="text-gray-900">{passPct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#10b981]" style={{ width: `${passPct}%` }}></div>
                          <div className="h-full bg-[#ef4444]" style={{ width: `${failPct}%` }}></div>
                          <div className="h-full bg-[#d97706]" style={{ width: `${blockedPct}%` }}></div>
                        </div>
                      </div>

                      {/* Edit Suite Action Button */}
                      {canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSuite(suite);
                          }}
                          className="px-3 py-1.5 border border-gray-200 text-[#2563eb] rounded-lg font-semibold text-xs hover:bg-blue-50/50 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                          Edit Suite
                        </button>
                      )}

                      {/* Toggle Collapse */}
                      <button
                        onClick={() => toggleSuite(suite.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <span
                          className={`material-symbols-outlined transition-transform duration-200 ${
                            isCollapsed ? '' : 'rotate-90'
                          }`}
                        >
                          chevron_right
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Suite Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/80 border-b border-outline-variant/60">
                          <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24">
                              ID
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                              TITLE &amp; COVERAGE
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">
                              PRIORITY
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">
                              TYPE
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-40 text-center">
                              APPROVAL
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-24 text-center">
                              VERSION
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32 text-center">
                              EXECUTION
                            </th>
                            <th className="px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-28 text-center">
                              ACTIONS
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/40">
                          {suite.testCases.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-6 py-8 text-center text-xs text-neutral"
                              >
                                No test cases in this suite. Click "Create Test Case" to add one.
                              </td>
                            </tr>
                          ) : (
                            suite.testCases.map((tc, index) => (
                              <tr key={`${suite.id}-${tc.id}-${index}`} className="hover:bg-blue-50/20 transition-colors group">
                                <td className="px-6 py-4 font-mono text-xs text-[#2563eb] font-bold">
                                  {tc.id}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-bold text-gray-900">{tc.title}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    {tc.coverageJiraKey && (
                                      <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[13px] text-gray-400">
                                          link
                                        </span>
                                        {tc.coverageJiraKey}
                                      </span>
                                    )}
                                    {tc.coverageJiraKey && (
                                      <span className="text-[11px] text-gray-400">•</span>
                                    )}
                                    <span className="text-[11px] text-gray-400">
                                      Updated {tc.updatedAt || 'recently'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <PriorityBadge priority={tc.priority} />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="inline-flex px-3 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wider">
                                    {tc.type || 'FUNCTIONAL'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <ApprovalBadge status={tc.approvalStatus} />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-gray-700">
                                    {tc.version || 'v1'}
                                    <span
                                      className="material-symbols-outlined text-sm text-gray-400 hover:text-primary transition-colors cursor-help"
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
                                <td className="px-6 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => setEditingCase(tc)}
                                      className="px-2.5 py-1 text-xs font-semibold text-[#2563eb] bg-blue-50/80 border border-blue-200 rounded-md hover:bg-blue-100 flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Edit Test Case"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">edit</span>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTestCase(tc.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                                      title="Delete Test Case"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">
                                        delete
                                      </span>
                                    </button>
                                  </div>
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
              <span className="w-2.5 h-2.5 bg-[#10b981] rounded-sm"></span> {stats.pass} Passed
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ef4444] rounded-sm"></span> {stats.fail} Failed
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#d97706] rounded-sm"></span> {stats.blocked} Blocked
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#6b7280] rounded-sm"></span> {stats.notRun} Not Run
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
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                onClick={() => setIsSuiteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSuite}
                className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Suite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Suite Modal (Full Rich Design) ── */}
      {editingSuite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-xl">folder_managed</span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-on-surface">
                      Edit Test Suite: {editingSuite.title}
                    </h2>
                    {editingSuite.release && (
                      <span className="text-[10px] font-bold bg-blue-50 text-primary px-2 py-0.5 rounded-full uppercase border border-blue-100">
                        {editingSuite.release}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    Update suite properties, target release, and approval execution rules.
                  </p>
                </div>
              </div>
              <button
                aria-label="Close modal"
                className="text-neutral hover:text-on-surface p-1.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setEditingSuite(null)}
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 bg-[#F9FAFB] space-y-4 overflow-y-auto">
              {/* Section 1: General Details */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-neutral uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-primary">tune</span>
                  General Suite Details
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface mb-1">
                      Suite Name <span className="text-error">*</span>
                    </label>
                    <input
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-on-surface transition-all"
                      type="text"
                      value={editingSuite.title}
                      onChange={(e) => setEditingSuite({ ...editingSuite, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface mb-1">
                      Target Release
                    </label>
                    <input
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-on-surface cursor-pointer"
                      type="text"
                      value={editingSuite.release || ''}
                      placeholder="e.g. v2.4.0-stable"
                      onChange={(e) => setEditingSuite({ ...editingSuite, release: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-on-surface mb-1">
                      Product / Module
                    </label>
                    <input
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-on-surface transition-all"
                      type="text"
                      value={editingSuite.productModule || ''}
                      placeholder="e.g. E-Commerce App / Checkout"
                      onChange={(e) =>
                        setEditingSuite({ ...editingSuite, productModule: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-on-surface mb-1">
                    Suite Description
                  </label>
                  <textarea
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-normal focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-on-surface h-14 resize-none transition-all"
                    value={editingSuite.description || ''}
                    onChange={(e) =>
                      setEditingSuite({ ...editingSuite, description: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Section 2: Approval Governance & Execution Rules */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-neutral uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">
                      verified_user
                    </span>
                    Approval Governance &amp; Execution Rules
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Active Enforcement
                  </span>
                </div>
                <div className="space-y-2">
                  {/* Rule 1: Require QA Approval */}
                  <div className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex flex-col pr-2">
                      <span className="text-xs font-bold text-on-surface">
                        Require QA Lead approval before execution
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        Only verified 'Approved' test cases can run in automated and manual suites.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={editingSuite.requireApproval ?? true}
                        onChange={(e) =>
                          setEditingSuite({ ...editingSuite, requireApproval: e.target.checked })
                        }
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Rule 2: Exclude unapproved from metrics */}
                  <div className="flex items-center justify-between gap-3 p-2.5 bg-blue-50/40 border border-blue-100 rounded-lg">
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-primary">
                          Exclude unapproved cases from health metrics
                        </span>
                        <span className="text-[9px] font-bold bg-white text-primary border border-primary/20 px-1 rounded">
                          Active
                        </span>
                      </div>
                      <span className="text-[10px] text-on-surface-variant">
                        Cases pending approval remain for authoring but are excluded from pass/fail KPIs.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={editingSuite.excludeUnapproved ?? true}
                        onChange={(e) =>
                          setEditingSuite({ ...editingSuite, excludeUnapproved: e.target.checked })
                        }
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {/* Rule 3: Execution Strategy */}
                  <div className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-on-surface">Execution Strategy</span>
                      <p className="text-[10px] text-neutral">
                        Defines runner dispatch mode during test runs
                      </p>
                    </div>
                    <select
                      value={editingSuite.executionStrategy || 'Sequential (Order by ID)'}
                      onChange={(e) =>
                        setEditingSuite({ ...editingSuite, executionStrategy: e.target.value })
                      }
                      className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
                    >
                      <option>Sequential (Order by ID)</option>
                      <option>Parallel Runners (Distributed)</option>
                      <option>Stop on First Blocker</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => handleDeleteSuite(editingSuite.id)}
                className="text-error hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                type="button"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                Delete Suite
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingSuite(null)}
                  className="px-4 py-1.5 text-xs font-bold text-on-surface-variant hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors cursor-pointer"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditSuite}
                  className="px-5 py-1.5 bg-white border border-primary text-primary hover:bg-blue-50 transition-colors rounded-lg text-xs font-bold shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base text-primary">save</span>
                  Save Suite Changes
                </button>
              </div>
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
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                onClick={() => setIsCaseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTestCase}
                className="px-5 py-2 rounded-lg border border-primary text-primary font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Test Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Test Case Modal ── */}
      {editingCase && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-outline flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit Test Case ({editingCase.id})</h2>
              <button
                className="text-neutral hover:text-on-surface"
                onClick={() => setEditingCase(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Test Case Title
                </label>
                <input
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  type="text"
                  value={editingCase.title}
                  onChange={(e) => setEditingCase({ ...editingCase, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Coverage Jira Key
                </label>
                <input
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  type="text"
                  value={editingCase.coverageJiraKey || ''}
                  onChange={(e) =>
                    setEditingCase({ ...editingCase, coverageJiraKey: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Priority
                  </label>
                  <select
                    value={editingCase.priority}
                    onChange={(e) =>
                      setEditingCase({
                        ...editingCase,
                        priority: e.target.value as TestCasePriority,
                      })
                    }
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
                    value={editingCase.type || 'FUNCTIONAL'}
                    onChange={(e) =>
                      setEditingCase({
                        ...editingCase,
                        type: e.target.value as TestCaseType,
                      })
                    }
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Approval Status
                  </label>
                  <select
                    value={editingCase.approvalStatus || 'DRAFT'}
                    onChange={(e) =>
                      setEditingCase({
                        ...editingCase,
                        approvalStatus: e.target.value as TestApprovalStatus,
                      })
                    }
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="APPROVED">Approved</option>
                    <option value="IN_REVIEW">In Review</option>
                    <option value="DRAFT">Draft (Not Approved Yet)</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Execution Result
                  </label>
                  <select
                    value={editingCase.lastResult}
                    onChange={(e) =>
                      setEditingCase({
                        ...editingCase,
                        lastResult: e.target.value as TestCaseResult,
                      })
                    }
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="UNTESTED">Not Run</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                onClick={() => setEditingCase(null)}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditCase}
                className="px-5 py-2 rounded-lg bg-primary text-white font-label-md text-label-md hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Changes
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
                  <span className="material-symbols-outlined text-primary animate-spin">
                    progress_activity
                  </span>
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
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportProgress(null);
                  }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {importProgress && (
                <>
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-on-surface-variant mb-2">
                      <span>
                        {importProgress.done} of {importProgress.total} imported
                      </span>
                      <span>
                        {importProgress.total > 0
                          ? Math.round((importProgress.done / importProgress.total) * 100)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 rounded-full"
                        style={{
                          width: `${
                            importProgress.total > 0
                              ? (importProgress.done / importProgress.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {!importing && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${
                        importProgress.errors.length === 0
                          ? 'bg-secondary-container/20 text-on-secondary-container'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {importProgress.errors.length === 0 ? 'task_alt' : 'info'}
                      </span>
                      {importProgress.errors.length === 0
                        ? `All ${importProgress.done} test case${
                            importProgress.done !== 1 ? 's' : ''
                          } imported successfully.`
                        : `${importProgress.done} imported, ${importProgress.errors.length} failed.`}
                    </div>
                  )}

                  {importProgress.errors.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                      <p className="text-xs font-bold text-neutral uppercase tracking-wider">
                        Errors
                      </p>
                      {importProgress.errors.map((e, i) => (
                        <div
                          key={i}
                          className="text-xs text-error bg-error-container/20 rounded px-2 py-1"
                        >
                          {e}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!importProgress && importing && (
                <p className="text-sm text-on-surface-variant">
                  Parsing file and creating test cases…
                </p>
              )}
            </div>

            {!importing && (
              <div className="px-6 pb-6 flex justify-between items-center">
                <p className="text-xs text-on-surface-variant">
                  <span className="font-semibold">Tip:</span> Export CSV first to see the expected format.
                </p>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportProgress(null);
                  }}
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
