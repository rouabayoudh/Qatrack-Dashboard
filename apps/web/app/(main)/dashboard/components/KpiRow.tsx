'use client';

export interface KpiStats {
  totalRequirements: number;
  newThisWeek: number;
  openDefectsCount: number;
  criticalDefectsCount: number;
  coveragePercent: number;
  coverageChange: number;
  activeExecutionsCount: number;
  activeRunners: string[];
}

export function KpiRow({ stats }: { stats: KpiStats }) {
  const isUp = stats.coverageChange >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Coverage Card */}
      <div className="bg-white p-4 rounded-lg border border-outline-variant shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <p className="text-label-md font-semibold text-on-surface-variant">Requirement Coverage</p>
          <span className="material-symbols-outlined text-primary">analytics</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-headline-lg font-bold">{stats.coveragePercent.toFixed(1)}%</span>
          <span className={`text-label-sm flex items-center font-bold ${isUp ? 'text-secondary' : 'text-error'}`}>
            <span className="material-symbols-outlined text-[14px]">
              {isUp ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {' '}{Math.abs(stats.coverageChange).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-surface-container-highest h-1 rounded-full mt-4">
          <div
            className="bg-primary h-full rounded-full chart-bar shadow-[0_0_8px_rgba(0,74,198,0.4)]"
            style={{ width: `${Math.min(stats.coveragePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Requirements Synced */}
      <div className="bg-white p-4 rounded-lg border border-outline-variant shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <p className="text-label-md font-semibold text-on-surface-variant">Requirements Synced</p>
          <span className="material-symbols-outlined text-primary">inventory_2</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-headline-lg font-bold">{stats.totalRequirements.toLocaleString()}</span>
          <span className="text-label-sm text-on-surface-variant">+{stats.newThisWeek} this week</span>
        </div>
        <div className="mt-4 flex gap-1">
          <div className="h-1 flex-1 bg-secondary rounded-full" />
          <div className="h-1 flex-1 bg-error rounded-full" />
          <div className="h-1 flex-1 bg-outline-variant rounded-full" />
          <div className="h-1 flex-1 bg-outline-variant rounded-full opacity-30" />
        </div>
      </div>

      {/* Open Defects */}
      <div className="bg-white p-4 rounded-lg border border-outline-variant shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <p className="text-label-md font-semibold text-on-surface-variant">Open Defects</p>
          <span className="material-symbols-outlined text-error">bug_report</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-headline-lg font-bold text-error">{stats.openDefectsCount}</span>
          <span className="text-label-sm text-error font-bold flex items-center">
            <span className="material-symbols-outlined text-[14px]">priority_high</span>
            {stats.criticalDefectsCount} Critical
          </span>
        </div>
        <p className="mt-4 text-label-sm text-on-surface-variant">MTTR: N/A</p>
      </div>

      {/* Active Executions */}
      <div className="bg-white p-4 rounded-lg border border-outline-variant shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
          <p className="text-label-md font-semibold text-on-surface-variant">Active Executions</p>
          <span className="material-symbols-outlined text-tertiary">rocket_launch</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-headline-lg font-bold">{stats.activeExecutionsCount}</span>
          {stats.activeExecutionsCount > 0 && (
            <span className="text-label-sm text-tertiary font-bold flex items-center animate-pulse">
              Running now
            </span>
          )}
          {stats.activeExecutionsCount === 0 && (
            <span className="text-label-sm text-on-surface-variant font-bold">Idle</span>
          )}
        </div>
        {stats.activeRunners.length > 0 ? (
          <div className="mt-4 flex -space-x-2">
            {stats.activeRunners.slice(0, 2).map((initials, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border-2 border-white bg-primary-container text-[10px] flex items-center justify-center text-white font-bold"
              >
                {initials}
              </div>
            ))}
            {stats.activeRunners.length > 2 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-surface-container-highest text-[10px] flex items-center justify-center text-on-surface-variant font-bold">
                +{stats.activeRunners.length - 2}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-label-sm text-on-surface-variant">No runners active</p>
        )}
      </div>
    </div>
  );
}
