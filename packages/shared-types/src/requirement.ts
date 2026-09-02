export type RequirementType = 'EPIC' | 'STORY' | 'BUG' | 'TASK';

export interface Requirement {
  id: string;
  jiraIssueKey: string;
  title: string;
  type: RequirementType;
  status: string;
  parentEpicKey?: string;
  component?: string;
  priority?: string;
  assignee?: string;
  description?: string;
  release?: string;
}

export type TestCaseResult = 'PASS' | 'FAIL' | 'UNTESTED' | 'BLOCKED';
export type TestCasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TestApprovalStatus = 'APPROVED' | 'IN_REVIEW' | 'DRAFT' | 'REJECTED';
export type TestCaseType = 'SMOKE' | 'REGRESSION' | 'FUNCTIONAL' | 'PERFORMANCE' | 'SECURITY';

export interface TestCase {
  id: string;
  suiteId?: string;
  title: string;
  coverageJiraKey?: string; // e.g. STORY-882
  priority: TestCasePriority;
  type?: TestCaseType;
  approvalStatus?: TestApprovalStatus;
  version?: string; // e.g. "v3"
  lastResult: TestCaseResult;
  executionDate?: string; // ISO date string
  tags?: string[];
  updatedAt?: string;
}

export interface TestSuite {
  id: string;
  title: string;
  description: string;
  release?: string;
  testCases: TestCase[];
}

export interface TraceabilityLink {
  requirementId: string;
  testCaseId: string;
}

export interface JiraConnectionStatus {
  connected: boolean;
  siteName?: string;
  lastSyncedAt?: string;
}