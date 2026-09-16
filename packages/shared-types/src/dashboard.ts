export interface TestExecution {
  id: string;          // e.g. "TR-8291"
  suiteName: string;
  status: 'PASSED' | 'FAILED' | 'ABORTED' | 'UNSTABLE';
  passPercent: number | null; // null when status is ABORTED
  durationSeconds: number;
  startedAt: string; // ISO timestamp
}

export interface DailyTrend {
  date: string; // YYYY-MM-DD
  passCount: number;
  failCount: number;
}

export interface ActiveExecution {
  id: string;
  suiteName: string;
  startedAt: string;
  runnerInitials: string; // for the avatar stack in the UI
}

export interface CoverageSummary {
  coveragePercent: number;      // 0-100
  changeFromLastWeek: number;   // signed, e.g. +2.4 or -1.1
}

export interface ComponentCoverage {
  component: string;
  coveragePercent: number;
}

export interface Project {
  id: string;
  key: string;   // Jira project key, e.g. "CLOUD"
  name: string;
}

export interface QualityHighlight {
  type: 'good' | 'bad';
  text: string;
}

export interface ProjectExecutionRow {
  name: string;
  tests: number;
  status: 'Healthy' | 'At Risk' | 'Critical';
  lastRun: string; // e.g. "2h ago"
}

export interface ProductDashboardStats {
  lastPassRate: number;           // 0-100 %
  passRateChange: number;         // signed delta e.g. +3.2
  requirementCoverage: number;    // 0-100 %
  coverageChange: number;         // signed delta
  openDefects: number;
  defectsTrend: string;           // e.g. "+2 this week"
  flakyTests: number;
  passRateTrend: number[];        // 5 weekly values (0-100)
  coverageTrend: number[];        // 5 weekly values (0-100)
  qualityHighlights: QualityHighlight[];
  projectRows: ProjectExecutionRow[];
}
