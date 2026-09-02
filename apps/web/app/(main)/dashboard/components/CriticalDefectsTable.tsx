'use client';

import type { Requirement } from '@qatrack/shared-types';

interface CriticalDefectsTableProps {
  defects?: Requirement[];
}

export function CriticalDefectsTable({ defects }: CriticalDefectsTableProps) {
  const items = defects ?? [];

  return (
    <div className="lg:col-span-6 bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
      <div className="p-4 border-b border-outline-variant flex justify-between items-center">
        <h3 className="font-headline-sm text-headline-sm">Critical Defects</h3>
        <span className="text-label-sm text-on-surface-variant font-medium">
          {items.length} {items.length === 1 ? 'Defect' : 'Defects'}
        </span>
      </div>
      <div className="overflow-x-auto">
        {items.length === 0 ? (
          <div className="py-12 px-4 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] text-secondary mb-2 block">
              check_circle
            </span>
            <p className="text-body-sm font-medium text-on-surface">No open defects</p>
            <p className="text-label-sm mt-1">
              All synced Jira bugs are resolved or none exist in this project.
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <tbody className="divide-y divide-outline-variant">
              {items.map((defect) => {
                const priorityUpper = (defect.priority || 'MEDIUM').toUpperCase();
                const isCritical =
                  priorityUpper === 'BLOCKER' ||
                  priorityUpper === 'CRITICAL' ||
                  priorityUpper === 'HIGH';

                return (
                  <tr key={defect.id} className="hover:bg-error/5 cursor-pointer transition-colors">
                    <td className={`p-3 border-l-4 ${isCritical ? 'border-error' : 'border-primary'}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-label-md text-on-surface font-mono">
                          {defect.jiraIssueKey}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                            isCritical ? 'bg-error' : 'bg-primary'
                          }`}
                        >
                          {priorityUpper}
                        </span>
                        {defect.status && (
                          <span className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                            {defect.status}
                          </span>
                        )}
                      </div>
                      <p className="text-body-sm font-semibold mt-1 text-on-surface">{defect.title}</p>
                      {defect.component && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Product: {defect.component}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <span className="text-label-sm text-on-surface-variant block">Assigned to</span>
                      <span className="text-label-md font-bold text-on-surface">
                        {defect.assignee || 'Unassigned'}
                      </span>
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
