'use client';

import type { ProjectExecutionRow } from '@qatrack/shared-types';

interface ProductCoverageBarProps {
  rows: ProjectExecutionRow[];
}

export function ProductCoverageBar({ rows }: ProductCoverageBarProps) {
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Product Execution Health</h3>
      <div className="space-y-4">
        {rows.map((row) => {
          const isHealthy = row.status === 'Healthy';
          const isAtRisk = row.status === 'At Risk';
          const statusBg = isHealthy
            ? 'bg-secondary-container/40 text-on-secondary-container'
            : isAtRisk
              ? 'bg-tertiary-container/40 text-on-tertiary-container'
              : 'bg-error-container text-on-error-container';

          return (
            <div key={row.name} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
              <div>
                <p className="font-semibold text-body-sm text-on-surface">{row.name}</p>
                <p className="text-label-sm text-on-surface-variant">
                  {row.tests} Test Cases • Last run {row.lastRun}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded text-label-sm font-bold uppercase tracking-wider ${statusBg}`}>
                {row.status}
              </span>
            </div>
          );
        })}

        {rows.length === 0 && (
          <p className="text-body-sm text-on-surface-variant text-center py-6">
            No project health data available.
          </p>
        )}
      </div>
    </div>
  );
}
