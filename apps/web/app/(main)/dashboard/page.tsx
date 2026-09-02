'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Requirement,
  TestExecution,
  DailyTrend,
  ActiveExecution,
  CoverageSummary,
  ComponentCoverage,
  Project,
} from '@qatrack/shared-types';
import {
  fetchCurrentUser,
  fetchRequirements,
  fetchExecutions,
  fetchActiveExecutions,
  fetchExecutionsTrend,
  fetchCoverageSummary,
  fetchCoverageByComponent,
  fetchProjects,
  fetchJiraStatus,
  fetchApi,
  type CurrentUser,
} from '@/lib/api';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { RecentExecutionsTable } from './components/RecentExecutionsTable';
import { CoverageByComponent } from './components/CoverageByComponent';
import { CriticalDefectsTable } from './components/CriticalDefectsTable';
import { EditWidgetsModal, DEFAULT_WIDGETS, type WidgetConfig } from './components/EditWidgetsModal';

const CLOSED_STATUSES = new Set(['Done', 'Closed', 'Resolved']);

function computeKpiStats(
  requirements: Requirement[],
  coverageSummary: CoverageSummary | null,
  activeExecutions: ActiveExecution[],
): KpiStats {
  const bugs = requirements.filter((r) => r.type === 'BUG');
  const openBugs = bugs.filter((b) => !CLOSED_STATUSES.has(b.status ?? ''));

  return {
    totalRequirements: requirements.length,
    newThisWeek: 0,
    openDefectsCount: openBugs.length,
    criticalDefectsCount: 0,
    coveragePercent: coverageSummary?.coveragePercent ?? 0,
    coverageChange: coverageSummary?.changeFromLastWeek ?? 0,
    activeExecutionsCount: activeExecutions.length,
    activeRunners: activeExecutions.map((e) => e.runnerInitials),
  };
}

function getOpenDefects(requirements: Requirement[], selectedProjectKey?: string): Requirement[] {
  const projectFiltered = selectedProjectKey
    ? requirements.filter((r) => r.jiraIssueKey.startsWith(`${selectedProjectKey}-`))
    : requirements;

  const list = projectFiltered.length > 0 ? projectFiltered : requirements;

  return list
    .filter((r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''))
    .slice(0, 10);
}

function DashboardContent() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [trend, setTrend] = useState<DailyTrend[]>([]);
  const [coverageSummary, setCoverageSummary] = useState<CoverageSummary | null>(null);
  const [coverageByComponent, setCoverageByComponent] = useState<ComponentCoverage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('');
  const [selectedRelease, setSelectedRelease] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState('Never');
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  const [widgets, setWidgets] = useState<WidgetConfig>(DEFAULT_WIDGETS);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('qatrack_dashboard_widgets');
      if (saved) {
        setWidgets({ ...DEFAULT_WIDGETS, ...JSON.parse(saved) });
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const handleSaveWidgets = (updated: WidgetConfig) => {
    setWidgets(updated);
    try {
      localStorage.setItem('qatrack_dashboard_widgets', JSON.stringify(updated));
    } catch {
      // Ignore localStorage write errors
    }
  };

  const loadDashboard = useCallback(async () => {
    setError(null);

    const currentUser = await fetchCurrentUser();
    if (!currentUser) {
      router.replace('/login');
      return;
    }
    setUser(currentUser);

    try {
      const [reqs, execs, activeExecs, execsTrend, summary, componentCoverage, projs, jiraStatus] =
        await Promise.all([
          fetchRequirements(),
          fetchExecutions(),
          fetchActiveExecutions(),
          fetchExecutionsTrend(7),
          fetchCoverageSummary(),
          fetchCoverageByComponent(),
          fetchProjects(),
          fetchJiraStatus().catch(() => ({ connected: false })),
        ]);

      setRequirements(reqs);
      setExecutions(execs);
      setActiveExecutions(activeExecs);
      setTrend(execsTrend);
      setCoverageSummary(summary);
      setCoverageByComponent(componentCoverage);
      setProjects(projs);

      // Default to the first project when projects load for the first time
      setSelectedProjectKey((prev) => prev || projs[0]?.key || '');

      if (jiraStatus?.lastSyncedAt) {
        setLastSynced(
          new Date(jiraStatus.lastSyncedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
      } else {
        setLastSynced('Never');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSync = async () => {
    if (!selectedProjectKey && projects.length > 0) {
      setError('Please select a project to sync.');
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const targetProjectKey = selectedProjectKey || projects[0]?.key || '';
      await fetchApi('/jira/sync', {
        method: 'POST',
        body: JSON.stringify({ projectKey: targetProjectKey }),
      });
      await loadDashboard();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading dashboard…
        </div>
      </div>
    );
  }

  // Filter requirements & defects by project and search query
  const filteredRequirements = requirements.filter((r) => {
    const matchesProject = !selectedProjectKey || r.jiraIssueKey.startsWith(`${selectedProjectKey}-`);
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      r.jiraIssueKey.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      (r.component && r.component.toLowerCase().includes(q)) ||
      (r.assignee && r.assignee.toLowerCase().includes(q));

    return matchesProject && matchesQuery;
  });

  const openDefects = filteredRequirements
    .filter((r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''))
    .slice(0, 10);

  const filteredExecutions = executions.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || e.suiteName.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
  });

  const kpiStats = computeKpiStats(filteredRequirements, coverageSummary, activeExecutions);

  const hasVisibleWidgets =
    widgets.recentExecutions ||
    widgets.coverageByComponent ||
    widgets.criticalDefects;

  return (
    <div className="flex min-h-screen bg-surface text-on-surface font-body-md selection:bg-primary-container selection:text-on-primary-container">
      <Sidebar user={user} />

      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <TopBar
          projects={projects}
          selectedProjectKey={selectedProjectKey}
          onProjectChange={setSelectedProjectKey}
          onSync={handleSync}
          syncing={syncing}
          lastSynced={lastSynced}
        />

        <div className="p-gutter overflow-y-auto space-y-6 max-w-container-max mx-auto w-full">
          {/* Page header */}
          <div className="flex justify-between items-end">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">
                QA Performance Dashboard
              </h1>
            </div>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant bg-white text-on-surface rounded font-semibold text-body-sm hover:bg-surface-container-low transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Edit Widgets
            </button>
          </div>

          {/* Green Synced with Jira Banner (Auto-dismisses after 3s) */}
          {showSyncSuccess && (
            <div className="p-3 bg-secondary-container/30 border border-secondary/20 rounded-lg flex items-center justify-between animate-fade-in transition-all">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                <p className="text-body-sm text-on-secondary-container">
                  Last synced with Jira: <span className="font-bold">Today at {lastSynced}</span>
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

          {error && (
            <div className="bg-error-container text-on-error-container border border-error rounded-lg p-3 text-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {widgets.recentExecutions && <RecentExecutionsTable executions={filteredExecutions} />}
            {widgets.coverageByComponent && <CoverageByComponent coverage={coverageByComponent} />}
            {widgets.criticalDefects && <CriticalDefectsTable defects={openDefects} />}
          </div>

          {!hasVisibleWidgets && (
            <div className="text-center py-16 bg-white border border-outline-variant rounded-xl p-8 space-y-3">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant">
                dashboard_customize
              </span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">No widgets currently visible</h3>
              <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
                All dashboard widgets are hidden. Click Edit Widgets below to choose what to display.
              </p>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded font-semibold text-body-sm hover:opacity-90 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Edit Widgets
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Edit Widgets Modal */}
      <EditWidgetsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        widgets={widgets}
        onSave={handleSaveWidgets}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-surface">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Loading dashboard…
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}