'use client';

import type {
  TestExecution,
  ComponentCoverage,
  Requirement,
} from '@qatrack/shared-types';
import { RecentExecutionsTable } from './RecentExecutionsTable';
import { CoverageByComponent } from './CoverageByComponent';
import { CriticalDefectsTable } from './CriticalDefectsTable';

interface ProjectLevelDashboardProps {
  executions: TestExecution[];
  coverageByComponent: ComponentCoverage[];
  openDefects: Requirement[];
  widgets: {
    recentExecutions: boolean;
    coverageByComponent: boolean;
    criticalDefects: boolean;
  };
}

export function ProjectLevelDashboard({
  executions,
  coverageByComponent,
  openDefects,
  widgets,
}: ProjectLevelDashboardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {widgets.recentExecutions && <RecentExecutionsTable executions={executions} />}
      {widgets.coverageByComponent && <CoverageByComponent coverage={coverageByComponent} />}
      {widgets.criticalDefects && <CriticalDefectsTable defects={openDefects} />}
    </div>
  );
}
