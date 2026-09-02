'use client';

import type { ComponentCoverage } from '@qatrack/shared-types';

function getCoverageColor(percent: number): string {
  if (percent >= 90) return 'bg-secondary';
  if (percent >= 70) return 'bg-primary';
  if (percent >= 50) return 'bg-tertiary-container';
  return 'bg-error';
}

export function CoverageByComponent({ coverage }: { coverage: ComponentCoverage[] }) {
  return (
    <div className="lg:col-span-4 bg-white border border-outline-variant rounded-lg p-4 shadow-sm">
      <h3 className="font-headline-sm text-headline-sm mb-6">Coverage by Product</h3>
      <div className="space-y-5">
        {coverage.map((c) => (
          <div key={c.component} className="space-y-1">
            <div className="flex justify-between text-label-md">
              <span className="font-semibold text-on-surface">{c.component}</span>
              <span className="text-on-surface-variant">{c.coveragePercent}%</span>
            </div>
            <div className="w-full bg-surface-container-low h-2 rounded-full overflow-hidden">
              <div
                className={`${getCoverageColor(c.coveragePercent)} h-full rounded-full chart-bar`}
                style={{ width: `${c.coveragePercent}%` }}
              />
            </div>
          </div>
        ))}
        {coverage.length === 0 && (
          <p className="text-center py-8 text-body-sm text-on-surface-variant">
            No coverage data yet. Sync requirements to see breakdown.
          </p>
        )}
      </div>
    </div>
  );
}
