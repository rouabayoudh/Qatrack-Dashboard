'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Requirement,
  TestExecution,
  DailyTrend,
  ActiveExecution,
  CoverageSummary,
  ComponentCoverage,
  Project,
  ProductDashboardStats,
  JiraConnectionStatus,
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
  fetchProductStats,
  fetchDefects,
  fetchApi,
  type CurrentUser,
  type DefectRecord,
} from '@/lib/api';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ProjectLevelDashboard } from './components/ProjectLevelDashboard';
import { ProductLevelDashboard } from './components/ProductLevelDashboard';
import { EditWidgetsModal, DEFAULT_WIDGETS, type WidgetConfig } from './components/EditWidgetsModal';
import { ProductEditWidgetsModal, DEFAULT_PRODUCT_WIDGETS, type ProductWidgetConfig } from './components/ProductEditWidgetsModal';

const CLOSED_STATUSES = new Set(['Done', 'Closed', 'Resolved']);

function DashboardContent() {
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [createdDefects, setCreatedDefects] = useState<DefectRecord[]>([]);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [trend, setTrend] = useState<DailyTrend[]>([]);
  const [coverageSummary, setCoverageSummary] = useState<CoverageSummary | null>(null);
  const [coverageByComponent, setCoverageByComponent] = useState<ComponentCoverage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [productStats, setProductStats] = useState<ProductDashboardStats | null>(null);

  const [selectedProjectKey, setSelectedProjectKey] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState('5 mins ago');
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Widget configurations
  const [widgets, setWidgets] = useState<WidgetConfig>(DEFAULT_WIDGETS);
  const [productWidgets, setProductWidgets] = useState<ProductWidgetConfig>(DEFAULT_PRODUCT_WIDGETS);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProductEditModalOpen, setIsProductEditModalOpen] = useState(false);

  // Derive dynamic product & project options from real synced Jira data
  const productOptions = useMemo(() => {
    const list: { key: string; name: string }[] = [];

    // Add real synced Jira projects
    for (const p of projects) {
      list.push({ key: p.key, name: p.name });
    }

    // Add distinct Jira components from synced requirements
    const compNames = Array.from(
      new Set(requirements.map((r) => r.component).filter(Boolean)),
    ) as string[];

    for (const comp of compNames) {
      if (!list.some((item) => item.name === comp || item.key === comp)) {
        list.push({ key: comp, name: comp });
      }
    }

    return list;
  }, [projects, requirements]);

  const [selectedView, setSelectedView] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<{ key: string; name: string }>(
    productOptions[0] || { key: 'all', name: 'All products (overview)' },
  );
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Synchronize default selected product when productOptions update
  useEffect(() => {
    if (productOptions.length > 0 && selectedView !== 'all') {
      const found = productOptions.find((p) => p.key === selectedView);
      if (found) {
        setSelectedProduct(found);
      } else if (productOptions[0]) {
        setSelectedProduct(productOptions[0]);
      }
    }
  }, [productOptions, selectedView]);

  useEffect(() => {
    try {
      const savedProject = localStorage.getItem('qatrack_dashboard_widgets');
      if (savedProject) setWidgets({ ...DEFAULT_WIDGETS, ...JSON.parse(savedProject) });

      const savedProduct = localStorage.getItem('qatrack_product_dashboard_widgets');
      if (savedProduct) setProductWidgets({ ...DEFAULT_PRODUCT_WIDGETS, ...JSON.parse(savedProduct) });
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const handleSaveWidgets = (updated: WidgetConfig) => {
    setWidgets(updated);
    try {
      localStorage.setItem('qatrack_dashboard_widgets', JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleSaveProductWidgets = (updated: ProductWidgetConfig) => {
    setProductWidgets(updated);
    try {
      localStorage.setItem('qatrack_product_dashboard_widgets', JSON.stringify(updated));
    } catch {
      // Ignore
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
      const [reqs, execs, activeExecs, execsTrend, summary, componentCoverage, projs, pStats, jiraStatus, cDefects] =
        await Promise.all([
          fetchRequirements(),
          fetchExecutions(),
          fetchActiveExecutions(),
          fetchExecutionsTrend(7),
          fetchCoverageSummary(),
          fetchCoverageByComponent(),
          fetchProjects(),
          fetchProductStats().catch(() => null),
          fetchJiraStatus().catch(() => ({ connected: false }) as JiraConnectionStatus),
          fetchDefects().catch(() => []),
        ]);

      setRequirements(reqs);
      setCreatedDefects(cDefects);
      setExecutions(execs);
      setActiveExecutions(activeExecs);
      setTrend(execsTrend);
      setCoverageSummary(summary);
      setCoverageByComponent(componentCoverage);
      setProjects(projs);
      setProductStats(pStats);

      setSelectedProjectKey((prev) => prev || projs[0]?.key || '');

      if (jiraStatus?.lastSyncedAt) {
        setLastSynced(
          new Date(jiraStatus.lastSyncedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        );
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

  const filteredRequirements = requirements.filter((r) => {
    const matchesProject = !selectedProjectKey || r.jiraIssueKey.startsWith(`${selectedProjectKey}-`);
    const q = searchQuery.toLowerCase().trim();
    return (
      matchesProject &&
      (!q ||
        r.jiraIssueKey.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.component && r.component.toLowerCase().includes(q)))
    );
  });

  const mappedCreatedDefects: Requirement[] = createdDefects
    .filter((d) => d.status !== 'CLOSED')
    .map((d) => ({
      id: d.id,
      jiraIssueKey: d.jiraKey,
      title: d.summary,
      type: 'BUG' as const,
      status: d.status,
      priority: d.severity || 'HIGH',
      component: d.projectKey || 'QAT',
      assignee: d.assignee || 'Unassigned',
    }));

  const openBugsFromReqs = filteredRequirements.filter(
    (r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''),
  );

  const openDefects = [...mappedCreatedDefects, ...openBugsFromReqs].slice(0, 10);
  const allRequirementsWithDefects = [...mappedCreatedDefects, ...filteredRequirements];

  const filteredExecutions = executions.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || e.suiteName.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
  });

  const effectiveCoverageByComponent: ComponentCoverage[] = useMemo(() => {
    if (coverageByComponent && coverageByComponent.length > 0) {
      return coverageByComponent;
    }
    if (requirements.length > 0) {
      const groups: Record<string, { total: number; verified: number }> = {};
      for (const req of requirements) {
        const projKey = req.jiraIssueKey ? req.jiraIssueKey.split('-')[0] : 'QATrack Core';
        const comp = req.component || projKey || 'Core Module';
        if (!groups[comp]) groups[comp] = { total: 0, verified: 0 };
        groups[comp].total += 1;
        if (CLOSED_STATUSES.has(req.status ?? '')) {
          groups[comp].verified += 1;
        }
      }
      return Object.entries(groups).map(([component, stats]) => ({
        component,
        coveragePercent: stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0,
      }));
    }
    if (projects.length > 0) {
      return projects.map((p) => ({
        component: p.name || p.key,
        coveragePercent: 0,
      }));
    }
    return [];
  }, [coverageByComponent, requirements, projects]);

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
          {/* Page Header matching images 1 and 2 */}
          <div className="flex justify-between items-end mb-4">
            <div className="flex-col">
              <h2 className="font-bold text-2xl md:text-3xl text-on-surface tracking-tight">
                QA Dashboard
              </h2>

              <div className="mt-4 relative inline-block w-full max-w-[320px]">
                <button
                  type="button"
                  onClick={() => setIsProductDropdownOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-white border border-outline-variant rounded-lg shadow-sm cursor-pointer hover:bg-surface-container-low transition-colors"
                >
                  {selectedView === 'all' ? (
                    <span className="text-body-md font-semibold text-on-surface">All products (overview)</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-label-sm font-bold text-on-surface-variant/70 uppercase tracking-wider">PRODUCT:</span>
                      <span className="text-body-md font-semibold text-on-surface">{selectedProduct.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant">more_horiz</span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                      {isProductDropdownOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    </span>
                  </div>
                </button>

                {isProductDropdownOpen && (
                  <ul className="absolute top-full left-0 w-full mt-1 bg-white border border-outline-variant rounded-lg shadow-xl z-50 overflow-hidden py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedView('all');
                          setIsProductDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-surface-container-low transition-colors text-body-md cursor-pointer ${
                          selectedView === 'all' ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface'
                        }`}
                      >
                        All products (overview)
                      </button>
                    </li>
                    {productOptions.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedView(item.key);
                            setSelectedProduct(item);
                            setIsProductDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-surface-container-low transition-colors text-body-md cursor-pointer ${
                            selectedView === item.key ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface'
                          }`}
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-body-sm text-on-surface-variant/80 mt-1 max-w-2xl leading-relaxed">
                This dashboard provides product-level metrics to communicate overall product quality and track testing progress for the selected product.
              </p>
            </div>

            <button
              onClick={() => {
                if (selectedView === 'all') {
                  setIsEditModalOpen(true);
                } else {
                  setIsProductEditModalOpen(true);
                }
              }}
              className="flex items-center gap-2 px-3 py-1.5 border border-outline-variant bg-white text-on-surface rounded font-semibold text-body-sm hover:bg-surface-container-low transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Edit Widgets
            </button>
          </div>

          {/* Green Synced Banner */}
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

          {/* Main Content */}
          {selectedView === 'all' ? (
            hasVisibleWidgets ? (
              <ProjectLevelDashboard
                executions={filteredExecutions}
                coverageByComponent={effectiveCoverageByComponent}
                openDefects={openDefects}
                widgets={widgets}
              />
            ) : (
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
            )
          ) : (
            <ProductLevelDashboard
              requirements={allRequirementsWithDefects}
              coverageSummary={coverageSummary}
              coverageByComponent={effectiveCoverageByComponent}
              executions={filteredExecutions}
              widgets={productWidgets}
              onOpenEditWidgets={() => setIsProductEditModalOpen(true)}
            />
          )}
        </div>
      </main>

      {/* Edit Widgets Modal (Overview Level) */}
      <EditWidgetsModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        widgets={widgets}
        onSave={handleSaveWidgets}
      />

      {/* Product Edit Widgets Modal */}
      <ProductEditWidgetsModal
        isOpen={isProductEditModalOpen}
        onClose={() => setIsProductEditModalOpen(false)}
        widgets={productWidgets}
        onSave={handleSaveProductWidgets}
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