'use client';

import type { TestExecution } from '@qatrack/shared-types';

interface RecentExecutionsTableProps {
  executions?: TestExecution[];
}

export function RecentExecutionsTable({ executions }: RecentExecutionsTableProps) {
  const items = executions ?? [];

  return (
    <div className="lg:col-span-8 bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
      <div className="p-4 border-b border-outline-variant flex justify-between items-center">
        <h3 className="font-headline-sm text-headline-sm">Recent Test Executions</h3>
        <span className="text-label-sm text-on-surface-variant font-medium">
          {items.length} {items.length === 1 ? 'Execution' : 'Executions'}
        </span>
      </div>
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="py-12 px-4 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] text-outline mb-2 block">
              checklist
            </span>
            <p className="text-body-sm font-medium text-on-surface">No test executions yet</p>
            <p className="text-label-sm mt-1">
              Test case execution results and test runs will appear here as tests are executed.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-cell-padding-h py-3 text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Case ID
                </th>
                <th className="px-cell-padding-h py-3 text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Test Case Title
                </th>
                <th className="px-cell-padding-h py-3 text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
                <th className="px-cell-padding-h py-3 text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-cell-padding-h py-3 text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Executed At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {items.map((item) => {
                const isPass = item.status === 'PASSED';
                const isFail = item.status === 'FAILED';
                const duration = `${Math.floor(item.durationSeconds / 60)}m ${String(
                  item.durationSeconds % 60,
                ).padStart(2, '0')}s`;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer group"
                  >
                    <td className="px-cell-padding-h py-cell-padding-v font-label-md text-primary font-mono">
                      #{item.id}
                    </td>
                    <td className="px-cell-padding-h py-cell-padding-v font-body-sm font-medium text-on-surface">
                      {item.suiteName}
                    </td>
                    <td
                      className={`px-cell-padding-h py-cell-padding-v font-body-sm font-bold ${
                        isPass
                          ? 'text-secondary'
                          : isFail
                            ? 'text-error'
                            : 'text-on-surface-variant'
                      }`}
                    >
                      {item.status}
                    </td>
                    <td className="px-cell-padding-h py-cell-padding-v font-body-sm text-on-surface-variant">
                      {duration}
                    </td>
                    <td className="px-cell-padding-h py-cell-padding-v font-body-sm text-on-surface-variant">
                      {item.startedAt ? new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
