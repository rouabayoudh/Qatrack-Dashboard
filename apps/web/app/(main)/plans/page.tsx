'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchApi,
  fetchCurrentUser,
  fetchProjects,
  fetchJiraStatus,
  fetchTestSuites,
  fetchTestPlans,
  fetchAvailableReleases,
  createTestPlan,
  updatePlanTestCaseResult,
  deleteTestPlan,
  type CurrentUser,
  type TestPlan,
} from '@/lib/api';
import type {
  TestSuite,
  Project,
  JiraConnectionStatus,
} from '@qatrack/shared-types';
import { Sidebar } from '../dashboard/components/Sidebar';

export default function TestPlansPage() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jiraStatus, setJiraStatus] = useState<JiraConnectionStatus>({ connected: false });
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [jiraReleases, setJiraReleases] = useState<string[]>([]);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [releaseFilter, setReleaseFilter] = useState('Release (All)');
  const [envFilter, setEnvFilter] = useState('Environment (All)');
  const [statusFilter, setStatusFilter] = useState('Status (All)');
  const [sortBy, setSortBy] = useState<'Recently Created' | 'Progress %' | 'Name'>('Recently Created');

  // Expanded card state
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Create Plan Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [planRelease, setPlanRelease] = useState('');
  const [planEnv, setPlanEnv] = useState<'Prod' | 'UAT' | 'SIT' | 'Dev'>('UAT');
  const [planSprint, setPlanSprint] = useState('');
  const [planEstHours, setPlanEstHours] = useState(24);
  const [selectedSuiteIds, setSelectedSuiteIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // ── Load Data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    setUser(currentUser);

    try {
      const [plansData, suitesData, projs, status, releases] = await Promise.all([
        fetchTestPlans().catch(() => []),
        fetchTestSuites().catch(() => []),
        fetchProjects().catch(() => []),
        fetchJiraStatus().catch(() => ({ connected: false })),
        fetchAvailableReleases().catch(() => []),
      ]);

      setPlans(plansData);
      setSuites(suitesData);
      setProjects(projs);
      setJiraStatus(status);
      setJiraReleases(releases);

      if (projs.length > 0 && !selectedProjectKey) {
        setSelectedProjectKey(projs[0].key);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load test plans');
    } finally {
      setLoading(false);
    }
  }, [router, selectedProjectKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Jira Sync ──────────────────────────────────────────────────────────────

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

  // ── Toggle Card Expansion ──────────────────────────────────────────────────

  const toggleExpand = (planId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [planId]: !prev[planId],
    }));
  };

  // ── Run / Advance Test Plan ────────────────────────────────────────────────

  const handleRunPlan = async (e: React.MouseEvent, plan: TestPlan) => {
    e.stopPropagation();
    // Advance UNTESTED/BLOCKED test cases to PASS via backend
    const untestedIds = plan.testCases
      .filter((tc) => tc.lastResult === 'UNTESTED' || tc.lastResult === 'BLOCKED')
      .map((tc) => tc.id);

    try {
      let updatedPlan = plan;
      for (const tcId of untestedIds) {
        updatedPlan = await updatePlanTestCaseResult(plan.id, tcId, 'PASS');
      }
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updatedPlan : p)));
    } catch (err: any) {
      // Optimistic update on backend error
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id !== plan.id) return p;
          return {
            ...p,
            status: 'In Progress' as const,
            testCases: p.testCases.map((tc) =>
              tc.lastResult === 'UNTESTED' || tc.lastResult === 'BLOCKED'
                ? { ...tc, lastResult: 'PASS' as const }
                : tc,
            ),
          };
        }),
      );
    }
  };

  // ── Create Test Plan ───────────────────────────────────────────────────────

  const handleCreatePlan = async () => {
    if (!planName.trim()) return;
    setCreating(true);
    try {
      const newPlan = await createTestPlan({
        name: planName.trim(),
        description: planDesc.trim() || undefined,
        release: planRelease,
        environment: planEnv,
        sprint: planSprint,
        estimatedHours: Number(planEstHours) || 20,
        suiteIds: selectedSuiteIds,
      });
      setPlans((prev) => [newPlan, ...prev]);
      setIsCreateModalOpen(false);
      setPlanName('');
      setPlanDesc('');
      setPlanRelease('');
      setPlanSprint('');
      setSelectedSuiteIds([]);
    } catch (err: any) {
      setError(err?.message || 'Failed to create test plan');
    } finally {
      setCreating(false);
    }
  };

  // ── Dynamic Releases ───────────────────────────────────────────────────────

  const availableReleases = useMemo(() => {
    const set = new Set<string>();
    // From Jira synced data
    jiraReleases.forEach((r) => set.add(r));
    // From plans themselves
    plans.forEach((p) => p.release && set.add(p.release));
    // From suites
    suites.forEach((s) => s.release && s.release !== 'Unassigned' && set.add(s.release));
    return ['Release (All)', ...Array.from(set).sort()];
  }, [plans, suites, jiraReleases]);

  // ── Filtering & Sorting ────────────────────────────────────────────────────

  const filteredPlans = useMemo(() => {
    let result = plans.filter((p) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesRelease = p.release.toLowerCase().includes(q);
        const matchesSprint = p.sprint.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesRelease && !matchesSprint) return false;
      }
      // Release filter
      if (releaseFilter !== 'Release (All)' && p.release !== releaseFilter) {
        return false;
      }
      // Environment filter
      if (envFilter !== 'Environment (All)' && p.environment !== envFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'Status (All)' && p.status !== statusFilter) {
        return false;
      }
      return true;
    });

    // Sorting
    if (sortBy === 'Progress %') {
      result = [...result].sort((a, b) => {
        const passA = a.testCases.filter((tc) => tc.lastResult === 'PASS').length;
        const pctA = a.testCases.length ? passA / a.testCases.length : 0;
        const passB = b.testCases.filter((tc) => tc.lastResult === 'PASS').length;
        const pctB = b.testCases.length ? passB / b.testCases.length : 0;
        return pctB - pctA;
      });
    } else if (sortBy === 'Name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Recently Created
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [plans, search, releaseFilter, envFilter, statusFilter, sortBy]);

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
          Loading test plans…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F9FAFB] text-on-surface font-body-md overflow-hidden">
      {/* ── Persistent SideNav ── */}
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
                placeholder="Search test plans..."
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
                  value={releaseFilter}
                  onChange={(e) => setReleaseFilter(e.target.value)}
                  className="bg-transparent border-none font-label-md text-label-md focus:ring-0 cursor-pointer p-0 text-on-surface font-semibold outline-none whitespace-nowrap"
                >
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

            {/* Outlined Sync Button matching Requirements & Test Cases */}
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
                onClick={() => {
                  alert('QATrack Test Plans:\n\n• Search: Filter test plans by title, description, or release.\n• Product: Switch active Jira project.\n• Release: Filter plans by release version.\n• Sync: Synchronize with Jira.');
                }}
                title="Help & Info"
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined">help_outline</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Main Content Area ── */}
        <div className="flex-1 overflow-hidden flex bg-[#F9FAFB]">
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {/* Synced banner */}
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
                  className="text-on-secondary-container/70 hover:text-on-secondary-container p-1 cursor-pointer"
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

            {/* Header */}
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">Test Plans</h2>
                <p className="text-on-surface-variant font-body-sm">
                  Manage and monitor active testing cycles for Q3 Release.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary text-on-primary h-10 px-5 rounded-lg font-label-md hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Test Plan
              </button>
            </div>

            {/* Filter & Sort Bar */}
            <div className="flex flex-wrap items-center gap-4 mb-8 p-3 bg-white border border-outline-variant rounded-xl shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Filter by:
                </span>
                <select
                  value={releaseFilter}
                  onChange={(e) => setReleaseFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded text-body-sm py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-primary cursor-pointer text-on-surface outline-none"
                >
                  {availableReleases.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>

                <select
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded text-body-sm py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-primary cursor-pointer text-on-surface outline-none"
                >
                  <option>Environment (All)</option>
                  <option value="Prod">Prod</option>
                  <option value="UAT">UAT</option>
                  <option value="SIT">SIT</option>
                  <option value="Dev">Dev</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container-low border-none rounded text-body-sm py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-primary cursor-pointer text-on-surface outline-none"
                >
                  <option>Status (All)</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Sort by:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-surface-container-low border-none rounded text-body-sm py-1.5 pl-3 pr-8 focus:ring-1 focus:ring-primary cursor-pointer text-on-surface outline-none"
                >
                  <option value="Recently Created">Recently Created</option>
                  <option value="Progress %">Progress %</option>
                  <option value="Name">Name</option>
                </select>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 auto-rows-min">
              {filteredPlans.map((plan) => {
                const isExpanded = expandedCards[plan.id] || false;
                const total = plan.testCases.length;
                const passCount = plan.testCases.filter((t) => t.lastResult === 'PASS').length;
                const failCount = plan.testCases.filter((t) => t.lastResult === 'FAIL').length;
                const blockCount = plan.testCases.filter((t) => t.lastResult === 'BLOCKED').length;
                const progressPct = total > 0 ? Math.round((passCount / total) * 100) : 0;

                // Color accent based on environment
                let envBadgeClass = 'border-primary text-primary';
                if (plan.environment === 'Prod') envBadgeClass = 'border-secondary text-secondary';
                if (plan.environment === 'SIT') envBadgeClass = 'border-outline text-outline';
                if (plan.environment === 'Dev') envBadgeClass = 'border-tertiary text-tertiary';

                return (
                  <div
                    key={plan.id}
                    onClick={() => toggleExpand(plan.id)}
                    className={`plan-card bg-white border border-outline-variant rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer overflow-hidden ${
                      isExpanded ? 'md:col-span-2 2xl:col-span-3' : ''
                    }`}
                  >
                    <div className="p-5 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="font-headline-sm text-on-surface font-bold leading-tight truncate">
                            {plan.name}
                          </h3>
                          {plan.description && (
                            <p className="text-xs text-on-surface-variant mt-1 line-clamp-1">
                              {plan.description}
                            </p>
                          )}
                        </div>
                        <button
                          title="Run / Advance cycle"
                          onClick={(e) => handleRunPlan(e, plan)}
                          className="bg-primary text-on-primary w-9 h-9 rounded-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all ml-4 shrink-0 cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-lg">play_arrow</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className={`px-2 py-0.5 border rounded-full font-label-sm ${envBadgeClass}`}>
                          {plan.environment}
                        </span>
                        <span className="px-2 py-0.5 bg-surface-container-highest text-on-surface-variant rounded-full font-label-sm">
                          {plan.release}
                        </span>
                        <span className="text-[10px] text-on-surface-variant font-medium px-2 py-0.5 bg-gray-100 rounded-full">
                          {plan.status}
                        </span>
                      </div>

                      <div className="space-y-3 flex-1">
                        <div className="flex justify-between items-center text-label-md">
                          <span className="text-on-surface-variant">Progress</span>
                          <span className="text-on-surface font-semibold">{progressPct}%</span>
                        </div>
                        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden flex">
                          <div
                            className="bg-secondary h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          ></div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 py-2">
                          <div className="text-center">
                            <p className="text-[10px] text-on-surface-variant uppercase mb-1">Pass</p>
                            <span className="text-body-sm font-bold text-secondary">{passCount}</span>
                          </div>
                          <div className="text-center border-x border-outline-variant">
                            <p className="text-[10px] text-on-surface-variant uppercase mb-1">Fail</p>
                            <span className="text-body-sm font-bold text-error">{failCount}</span>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] text-on-surface-variant uppercase mb-1">Block</p>
                            <span className="text-body-sm font-bold text-amber-500">{blockCount}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-outline-variant flex justify-between items-center text-label-sm text-on-surface-variant">
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">bolt</span>
                          <span>{plan.sprint}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          <span>Est. {plan.estimatedHours}h</span>
                        </div>
                        <div className="flex items-center gap-1 text-primary text-xs font-semibold">
                          <span>{total} case{total !== 1 ? 's' : ''}</span>
                          <span
                            className={`material-symbols-outlined text-sm transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          >
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Section */}
                    {isExpanded && (
                      <div className="border-t border-outline-variant bg-surface-container-lowest p-5 animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-sm text-on-surface">Included Test Cases</h4>
                          <span className="text-xs text-on-surface-variant">
                            {plan.testCases.length} total test cases assigned
                          </span>
                        </div>

                        {plan.testCases.length === 0 ? (
                          <p className="text-center text-on-surface-variant py-4 italic text-sm">
                            No test cases assigned to this plan yet.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-body-sm">
                              <thead className="text-on-surface-variant border-b border-outline-variant text-[11px] uppercase tracking-wider font-bold">
                                <tr>
                                  <th className="pb-2 font-medium">TC ID</th>
                                  <th className="pb-2 font-medium">Title</th>
                                  <th className="pb-2 font-medium">Level</th>
                                  <th className="pb-2 font-medium">Type</th>
                                  <th className="pb-2 font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-outline-variant/50">
                                {plan.testCases.map((tc) => (
                                  <tr key={tc.id} className="hover:bg-blue-50/20 transition-colors">
                                    <td className="py-2.5 text-primary font-mono font-medium text-xs">
                                      {tc.id}
                                    </td>
                                    <td className="py-2.5 font-medium text-on-surface">{tc.title}</td>
                                    <td className="py-2.5">
                                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-gray-100 text-on-surface-variant">
                                        {tc.priority || 'MEDIUM'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 text-xs text-on-surface-variant">
                                      {tc.type || 'FUNCTIONAL'}
                                    </td>
                                    <td className="py-2.5">
                                      {tc.lastResult === 'PASS' && (
                                        <span className="text-secondary font-bold text-xs flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">check</span> Pass
                                        </span>
                                      )}
                                      {tc.lastResult === 'FAIL' && (
                                        <span className="text-error font-bold text-xs flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">close</span> Fail
                                        </span>
                                      )}
                                      {tc.lastResult === 'BLOCKED' && (
                                        <span className="text-amber-600 font-bold text-xs flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">block</span> Block
                                        </span>
                                      )}
                                      {(!tc.lastResult || tc.lastResult === 'UNTESTED') && (
                                        <span className="text-on-surface-variant font-medium text-xs flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">schedule</span> Untested
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty State / Add Card */}
              <div
                onClick={() => setIsCreateModalOpen(true)}
                className="border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-10 hover:border-primary hover:bg-surface-container-low transition-all cursor-pointer group min-h-[300px]"
              >
                <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4 group-hover:bg-primary-fixed group-hover:text-primary transition-all">
                  <span className="material-symbols-outlined text-3xl">add_task</span>
                </div>
                <h4 className="font-headline-sm text-on-surface font-bold">Create New Test Plan</h4>
                <p className="text-body-sm text-on-surface-variant mt-1 text-center max-w-[220px]">
                  Combine multiple test suites into a new testing cycle.
                </p>
                <button className="mt-6 text-primary font-label-md flex items-center gap-2 hover:underline cursor-pointer">
                  Get Started
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Create Test Plan Modal ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="p-6 border-b border-outline flex items-center justify-between">
              <h2 className="text-lg font-bold">Create New Test Plan</h2>
              <button
                className="text-neutral hover:text-on-surface cursor-pointer"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Plan Name *
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g. Q3 Core Banking Regression"
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Description
                </label>
                <textarea
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                  placeholder="Goals, target coverage, and scope..."
                  className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Release Version
                  </label>
                  {jiraReleases.length > 0 ? (
                    <select
                      value={planRelease}
                      onChange={(e) => setPlanRelease(e.target.value)}
                      className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm cursor-pointer"
                    >
                      <option value="">— Select a release —</option>
                      {jiraReleases.map((rel) => (
                        <option key={rel} value={rel}>{rel}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={planRelease}
                      onChange={(e) => setPlanRelease(e.target.value)}
                      placeholder="e.g. v2.4.0 (sync Jira to load versions)"
                      className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Environment
                  </label>
                  <select
                    value={planEnv}
                    onChange={(e) => setPlanEnv(e.target.value as any)}
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm cursor-pointer"
                  >
                    <option value="Prod">Prod</option>
                    <option value="UAT">UAT</option>
                    <option value="SIT">SIT</option>
                    <option value="Dev">Dev</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Sprint Cycle
                  </label>
                  <input
                    type="text"
                    value={planSprint}
                    onChange={(e) => setPlanSprint(e.target.value)}
                    placeholder="Sprint 45"
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    value={planEstHours}
                    onChange={(e) => setPlanEstHours(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral uppercase mb-1.5">
                  Select Included Test Suites
                </label>
                {suites.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">
                    No suites available. Test cases from global pool will be linked.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto border border-outline-variant rounded-lg p-2 custom-scrollbar">
                    {suites.map((suite) => {
                      const isSelected = selectedSuiteIds.includes(suite.id);
                      return (
                        <label
                          key={suite.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-surface-container-low rounded cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedSuiteIds((prev) =>
                                prev.includes(suite.id)
                                  ? prev.filter((id) => id !== suite.id)
                                  : [...prev, suite.id],
                              );
                            }}
                            className="rounded border-outline text-primary focus:ring-primary"
                          />
                          <span className="font-semibold text-on-surface">{suite.title}</span>
                          <span className="text-on-surface-variant ml-auto">
                            ({suite.testCases.length} cases)
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50 rounded-b-xl flex justify-end gap-3 border-t border-outline-variant">
              <button
                className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!planName.trim() || creating}
                className="px-5 py-2 rounded-lg bg-primary text-white font-label-md text-label-md hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${creating ? 'animate-spin' : ''}`}>
                  {creating ? 'progress_activity' : 'add'}
                </span>
                {creating ? 'Creating…' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
