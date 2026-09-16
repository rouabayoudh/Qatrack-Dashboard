'use client';

import type {
  Requirement,
  CoverageSummary,
  ComponentCoverage,
  TestExecution,
} from '@qatrack/shared-types';
import type { ProductWidgetConfig } from './ProductEditWidgetsModal';
import { RecentExecutionsTable } from './RecentExecutionsTable';

interface ProductLevelDashboardProps {
  requirements: Requirement[];
  coverageSummary: CoverageSummary | null;
  coverageByComponent: ComponentCoverage[];
  executions: TestExecution[];
  widgets: ProductWidgetConfig;
  onOpenEditWidgets: () => void;
}

const CLOSED_STATUSES = new Set(['Done', 'Closed', 'Resolved']);

function getCoverageColor(percent: number): string {
  if (percent >= 90) return 'bg-secondary';
  if (percent >= 70) return 'bg-primary';
  if (percent >= 50) return 'bg-tertiary-container';
  return 'bg-error';
}

export function ProductLevelDashboard({
  requirements,
  coverageSummary,
  coverageByComponent,
  executions,
  widgets,
  onOpenEditWidgets,
}: ProductLevelDashboardProps) {
  const openBugs = requirements.filter(
    (r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''),
  );
  const criticalBugs = openBugs.filter(
    (b) =>
      b.priority?.toUpperCase() === 'CRITICAL' ||
      b.priority?.toUpperCase() === 'HIGH' ||
      b.priority?.toUpperCase() === 'BLOCKER',
  );

  const totalReqs = requirements.length;
  const completedReqs = requirements.filter((r) => CLOSED_STATUSES.has(r.status ?? '')).length;
  const computedCoveragePercent =
    coverageSummary?.coveragePercent ?? (totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0);

  // Compute pass rate from actual test executions
  const validExecs = executions.filter((e) => e.passPercent !== null);
  const avgPassRate =
    validExecs.length > 0
      ? Math.round(validExecs.reduce((acc, e) => acc + (e.passPercent ?? 0), 0) / validExecs.length)
      : 0;

  const hasAnyVisible =
    widgets.kpiCards ||
    widgets.passRateTrend ||
    widgets.coverageTrend ||
    widgets.qualityHighlights ||
    widgets.productCoverage ||
    widgets.recentExecutions;

  return (
    <div className="space-y-6">
      {/* PRODUCT QUALITY (KPI Cards) */}
      {widgets.kpiCards && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 border border-outline-variant rounded-lg shadow-sm">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Pass Rate</p>
            <div className="flex items-end gap-2 mt-1">
              <h4 className="text-headline-md font-bold text-on-surface">{avgPassRate}%</h4>
              <span className="text-secondary text-label-sm font-bold flex items-center mb-1">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>+2.1%
              </span>
            </div>
          </div>

          <div className="bg-white p-4 border border-outline-variant rounded-lg shadow-sm">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Requirement Coverage</p>
            <div className="flex items-end gap-2 mt-1">
              <h4 className="text-headline-md font-bold text-on-surface">{computedCoveragePercent}%</h4>
              <span className="text-secondary text-label-sm font-bold flex items-center mb-1">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>+1.8%
              </span>
            </div>
          </div>

          <div className="bg-white p-4 border border-outline-variant rounded-lg shadow-sm">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Open Defects</p>
            <div className="flex items-end gap-2 mt-1">
              <h4 className="text-headline-md font-bold text-on-surface">{openBugs.length}</h4>
              <span className="text-error text-label-sm font-bold mb-1">
                {criticalBugs.length} Critical
              </span>
            </div>
          </div>

          <div className="bg-white p-4 border border-outline-variant rounded-lg shadow-sm">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Synced Requirements</p>
            <div className="flex items-end gap-2 mt-1">
              <h4 className="text-headline-md font-bold text-on-surface">{totalReqs}</h4>
              <span className="text-on-surface-variant/70 text-label-sm mb-1 font-medium">Jira items</span>
            </div>
          </div>
        </div>
      )}

      {/* QUALITY TRENDS & HIGHLIGHTS */}
      {(widgets.passRateTrend || widgets.coverageTrend || widgets.qualityHighlights) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${widgets.qualityHighlights ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
            {widgets.passRateTrend && (
              <div className="bg-white border border-outline-variant rounded-lg p-4 shadow-sm">
                <h3 className="font-headline-sm text-headline-sm mb-4 text-on-surface font-semibold">Pass Rate Trend</h3>
                <div className="h-32 flex items-end gap-1.5 pt-2">
                  <div className="flex-1 bg-secondary/20 h-[60%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">60%</span>
                  </div>
                  <div className="flex-1 bg-secondary/20 h-[75%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">75%</span>
                  </div>
                  <div className="flex-1 bg-secondary/20 h-[70%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">70%</span>
                  </div>
                  <div className="flex-1 bg-secondary/20 h-[85%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">85%</span>
                  </div>
                  <div className="flex-1 bg-secondary h-[94%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-secondary opacity-0 group-hover:opacity-100 transition-opacity">{avgPassRate}%</span>
                  </div>
                </div>
              </div>
            )}

            {widgets.coverageTrend && (
              <div className="bg-white border border-outline-variant rounded-lg p-4 shadow-sm">
                <h3 className="font-headline-sm text-headline-sm mb-4 text-on-surface font-semibold">Coverage Trend</h3>
                <div className="h-32 flex items-end gap-1.5 pt-2">
                  <div className="flex-1 bg-primary/20 h-[40%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">40%</span>
                  </div>
                  <div className="flex-1 bg-primary/20 h-[55%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">55%</span>
                  </div>
                  <div className="flex-1 bg-primary/20 h-[65%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">65%</span>
                  </div>
                  <div className="flex-1 bg-primary/20 h-[75%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity">75%</span>
                  </div>
                  <div className="flex-1 bg-primary h-[82%] rounded-t group relative">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">{computedCoveragePercent}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {widgets.qualityHighlights && (
            <div className="lg:col-span-4 bg-white border border-outline-variant rounded-lg p-4 shadow-sm">
              <h3 className="font-headline-sm text-headline-sm mb-4 text-on-surface font-semibold">Quality Highlights</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-2 text-body-sm text-on-surface">
                  <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                  Coverage level is {computedCoveragePercent}% across synced items
                </li>
                <li className="flex items-center gap-2 text-body-sm text-on-surface">
                  <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
                  {completedReqs} of {totalReqs} requirements verified
                </li>
                {criticalBugs.length > 0 ? (
                  <li className="flex items-center gap-2 text-body-sm text-error font-semibold p-2 bg-error/5 rounded">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    {criticalBugs.length} critical defect{criticalBugs.length > 1 ? 's' : ''} active
                  </li>
                ) : (
                  <li className="flex items-center gap-2 text-body-sm text-secondary font-semibold p-2 bg-secondary/5 rounded">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    No open critical defects
                  </li>
                )}
                {openBugs.length > 0 && (
                  <li className="flex items-center gap-2 text-body-sm text-error font-semibold p-2 bg-error/5 rounded">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    {openBugs.length} total open defect{openBugs.length > 1 ? 's' : ''} in Jira
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* PRODUCT COVERAGE & RECENT EXECUTIONS */}
      {(widgets.productCoverage || widgets.recentExecutions) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {widgets.productCoverage && (
            <div className={`${widgets.recentExecutions ? 'lg:col-span-4' : 'lg:col-span-12'} bg-white border border-outline-variant rounded-lg p-4 shadow-sm`}>
              <h3 className="font-headline-sm text-headline-sm mb-6 text-on-surface font-semibold">Product Coverage</h3>
              <div className="space-y-5">
                {coverageByComponent.map((c) => (
                  <div key={c.component} className="space-y-1">
                    <div className="flex justify-between text-label-md">
                      <span className="font-semibold text-on-surface">{c.component}</span>
                      <span className="text-on-surface-variant font-bold">{c.coveragePercent}%</span>
                    </div>
                    <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
                      <div
                        className={`${getCoverageColor(c.coveragePercent)} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${c.coveragePercent}%` }}
                      />
                    </div>
                  </div>
                ))}
                {coverageByComponent.length === 0 && (
                  <p className="text-center py-8 text-body-sm text-on-surface-variant">
                    No component coverage data available yet. Sync Jira issues to see breakdown.
                  </p>
                )}
              </div>
            </div>
          )}

          {widgets.recentExecutions && <RecentExecutionsTable executions={executions} />}
        </div>
      )}

      {!hasAnyVisible && (
        <div className="text-center py-16 bg-white border border-outline-variant rounded-xl p-8 space-y-3">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant">dashboard_customize</span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">No product widgets currently visible</h3>
          <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
            All product level widgets are hidden. Click Edit Widgets to choose what to display.
          </p>
          <button
            onClick={onOpenEditWidgets}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded font-semibold text-body-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">edit_note</span>
            Edit Widgets
          </button>
        </div>
      )}
    </div>
  );
}
