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
