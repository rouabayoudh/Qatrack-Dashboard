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
import { TopBar } from '../dashboard/components/TopBar';

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
  const [coverageSearch, setCoverageSearch] = useState('');
  const [expandedSuitesModal, setExpandedSuitesModal] = useState<Record<string, boolean>>({});

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
    const SENTINEL = 'Release (All)';
    const set = new Set<string>();
    const addIfValid = (r: string) => {
      if (r && r !== SENTINEL && r !== 'Unassigned') set.add(r);
    };
    // From Jira synced data
    jiraReleases.forEach(addIfValid);
    // From plans themselves
    plans.forEach((p) => addIfValid(p.release ?? ''));
    // From suites
    suites.forEach((s) => addIfValid(s.release ?? ''));
    return [SENTINEL, ...Array.from(set).sort()];
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
        {/* Functional TopBar with working notifications, settings & help */}
        <TopBar
          projects={projects}
          selectedProjectKey={selectedProjectKey}
          onProjectChange={setSelectedProjectKey}
          syncing={syncing}
          onSync={handleSync}
        />

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-on-surface">
                    Test Plans
                  </h1>
                  {/* Product / Project Level selector pill matching user screenshot */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedProjectKey}
                      onChange={(e) => setSelectedProjectKey(e.target.value)}
                      className="appearance-none bg-white border border-gray-200 text-primary font-semibold text-xs rounded-lg px-3 py-1.5 pr-8 shadow-sm hover:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer transition-all"
                    >
                      <option value="">Product: All Products</option>
                      {projects.length === 0 ? (
                        <>
                          <option value="PE">Product: Platform Engine (PE)</option>
                          <option value="UI">Product: User Interface (UI)</option>
                          <option value="AC">Product: API Core (AC)</option>
                        </>
                      ) : (
                        projects.map((p) => (
                          <option key={p.key} value={p.key}>
                            Product: {p.name} ({p.key})
                          </option>
                        ))
                      )}
                    </select>
                    <span className="material-symbols-outlined text-primary text-base absolute right-2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
                <p className="text-on-surface-variant text-sm mt-1">
                  Manage, execute, and track comprehensive test cycles and milestone verification across releases.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-primary text-on-primary h-10 px-5 rounded-lg font-label-md hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
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
                  {availableReleases.map((rel, index) => (
                    <option key={`${rel}-${index}`} value={rel}>
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
                          title="Run test cycle in Execution"
                          onClick={(e) => { e.stopPropagation(); router.push('/execution'); }}
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

      {/* ── Create Test Plan Modal (Full Rich Spec Design) ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-[720px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 my-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">event_note</span>
                </div>
                <div>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    Create Test Plan
                  </h2>
                  <p className="text-on-surface-variant text-[12px]">
                    Define objectives, schedule, and scope for testing.
                  </p>
                </div>
              </div>
              <button
                aria-label="Close modal"
                className="w-8 h-8 rounded-full hover:bg-surface-container transition-colors flex items-center justify-center text-outline cursor-pointer"
                onClick={() => setIsCreateModalOpen(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">
              {/* Section 1: Plan Details */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
                    Plan Details
                  </h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface-variant mb-1.5">
                      Plan Name <span className="text-error">*</span>
                    </label>
                    <input
                      className="w-full h-10 px-3 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      placeholder="e.g., Q3 Regression - Payment Gateway"
                      type="text"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-body-sm font-medium text-on-surface-variant mb-1.5">
                        Release
                      </label>
                      <div className="relative">
                        <select
                          value={planRelease}
                          onChange={(e) => setPlanRelease(e.target.value)}
                          className="w-full h-10 px-3 pr-10 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none bg-white cursor-pointer"
                        >
                          <option value="">Select Release</option>
                          {availableReleases.map((rel) => (
                            <option key={rel} value={rel}>
                              {rel}
                            </option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-body-sm font-medium text-on-surface-variant mb-1.5">
                        Environment
                      </label>
                      <div className="relative">
                        <select
                          value={planEnv}
                          onChange={(e) => setPlanEnv(e.target.value as any)}
                          className="w-full h-10 px-3 pr-10 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none bg-white cursor-pointer"
                        >
                          <option value="UAT">UAT</option>
                          <option value="Prod">Prod</option>
                          <option value="SIT">SIT</option>
                          <option value="Dev">Dev</option>
                          <option value="Windows">Windows</option>
                          <option value="Linux">Linux</option>
                          <option value="macOS">macOS</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                          expand_more
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2: Schedule */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
                    Schedule
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface-variant mb-1.5">
                      Sprint Name
                    </label>
                    <input
                      className="w-full h-10 px-3 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="e.g., Sprint 45"
                      type="text"
                      value={planSprint}
                      onChange={(e) => setPlanSprint(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-body-sm font-medium text-on-surface-variant mb-1.5">
                      Estimation (Hours / Days)
                    </label>
                    <input
                      className="w-full h-10 px-3 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      min="1"
                      placeholder="8"
                      type="number"
                      value={planEstHours}
                      onChange={(e) => setPlanEstHours(Number(e.target.value))}
                    />
                  </div>
                </div>
              </section>

              {/* Section 3: Description */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
                    Description
                  </h3>
                </div>
                <textarea
                  className="w-full p-3 border border-outline-variant rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  placeholder="Briefly describe the scope of this test plan..."
                  rows={4}
                  value={planDesc}
                  onChange={(e) => setPlanDesc(e.target.value)}
                />
              </section>

              {/* Section 4: Test Coverage */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-4 bg-primary rounded-full"></span>
                    <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
                      Test Coverage
                    </h3>
                  </div>
                  <div
                    className={`px-2.5 py-1 rounded-full border transition-all ${
                      selectedSuiteIds.length > 0
                        ? 'bg-primary-fixed border-primary/40'
                        : 'bg-surface-container border-primary/20'
                    }`}
                  >
                    <span className="text-primary font-bold text-[11px] uppercase tracking-wide">
                      {selectedSuiteIds.length > 0
                        ? `${selectedSuiteIds.length} suite(s) selected`
                        : '0 test cases selected'}
                    </span>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="relative mb-3">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    search
                  </span>
                  <input
                    className="w-full h-9 pl-10 pr-4 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm focus:ring-1 focus:ring-primary outline-none"
                    placeholder="Filter suites or cases..."
                    type="text"
                    value={coverageSearch}
                    onChange={(e) => setCoverageSearch(e.target.value)}
                  />
                </div>

                {/* Scrollable Suites Accordion List */}
                <div className="border border-outline-variant rounded-lg overflow-hidden divide-y divide-outline-variant">
                  {suites.length === 0 ? (
                    <div className="p-4 text-center text-xs text-on-surface-variant italic">
                      No test suites available. Global test cases will be included automatically.
                    </div>
                  ) : (
                    suites
                      .filter((s) =>
                        coverageSearch
                          ? s.title.toLowerCase().includes(coverageSearch.toLowerCase()) ||
                            s.testCases.some((tc) =>
                              tc.title.toLowerCase().includes(coverageSearch.toLowerCase()),
                            )
                          : true,
                      )
                      .map((suite) => {
                        const isSuiteSelected = selectedSuiteIds.includes(suite.id);
                        const isExpanded = expandedSuitesModal[suite.id];
                        return (
                          <div key={suite.id} className="suite-container group">
                            <div
                              className="flex items-center justify-between p-3 bg-surface-container-low border-b border-outline-variant hover:bg-surface-container transition-colors cursor-pointer"
                              onClick={() =>
                                setExpandedSuitesModal((prev) => ({
                                  ...prev,
                                  [suite.id]: !prev[suite.id],
                                }))
                              }
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  className="w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                                  type="checkbox"
                                  checked={isSuiteSelected}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => {
                                    setSelectedSuiteIds((prev) =>
                                      prev.includes(suite.id)
                                        ? prev.filter((id) => id !== suite.id)
                                        : [...prev, suite.id],
                                    );
                                  }}
                                />
                                <span
                                  className={`material-symbols-outlined text-outline transition-transform ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`}
                                >
                                  chevron_right
                                </span>
                                <span className="font-medium text-body-md text-on-surface">
                                  {suite.title}
                                </span>
                              </div>
                              <span className="text-on-surface-variant text-[11px] font-medium bg-white px-2 py-0.5 rounded border border-outline-variant">
                                {suite.testCases.length} Cases
                              </span>
                            </div>
                            {isExpanded && (
                              <div className="divide-y divide-outline-variant bg-surface-container-lowest">
                                {suite.testCases.length === 0 ? (
                                  <div className="px-10 py-2 text-xs text-on-surface-variant italic">
                                    No test cases in this suite.
                                  </div>
                                ) : (
                                  suite.testCases.map((tc, tcIndex) => (
                                    <label
                                      key={`modal-${suite.id}-${tc.id}-${tcIndex}`}
                                      className="flex items-center gap-3 px-10 py-2.5 hover:bg-surface-container-low cursor-pointer group/item"
                                    >
                                      <input
                                        className="case-checkbox w-4 h-4 rounded border-outline text-primary focus:ring-primary cursor-pointer"
                                        type="checkbox"
                                        checked={isSuiteSelected}
                                        onChange={() => {
                                          setSelectedSuiteIds((prev) =>
                                            prev.includes(suite.id)
                                              ? prev.filter((id) => id !== suite.id)
                                              : [...prev, suite.id],
                                          );
                                        }}
                                      />
                                      <span className="text-body-sm text-on-surface-variant group-hover/item:text-on-surface transition-colors">
                                        <span className="font-semibold text-primary mr-1">
                                          {tc.id}:
                                        </span>
                                        {tc.title}
                                      </span>
                                    </label>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-end gap-3 sticky bottom-0 shrink-0">
              <button
                className="px-5 h-10 border border-outline-variant text-on-surface-variant font-medium rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
                onClick={() => setIsCreateModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!planName.trim() || creating}
                className="px-5 h-10 bg-primary text-white font-bold rounded-lg hover:bg-primary-container shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                type="button"
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
