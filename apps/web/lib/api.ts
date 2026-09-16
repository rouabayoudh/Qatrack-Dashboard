const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Sends the httpOnly token cookie automatically
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    const errText = await res.text();
    throw new Error(errText || `API error: ${res.status}`);
  }

  return res.json();
}

import type {
  Requirement,
  TestExecution,
  DailyTrend,
  ActiveExecution,
  CoverageSummary,
  ComponentCoverage,
  Project,
  JiraConnectionStatus,
  ProductDashboardStats,
} from '@qatrack/shared-types';

export type {
  Requirement,
  TestExecution,
  DailyTrend,
  ActiveExecution,
  CoverageSummary,
  ComponentCoverage,
  Project,
  JiraConnectionStatus,
  ProductDashboardStats,
};

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

/**
 * Calls GET /auth/me. Returns the user if the qatrack_token cookie is
 * valid, or null if the request 401s or otherwise fails (caller decides
 * whether to redirect to /login).
 */
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data?.user ?? null;
  } catch {
    // Network error, backend down, etc. Treat the same as "not logged in"
    // rather than throwing, so the page can redirect cleanly.
    return null;
  }
}

/**
 * Calls GET /jira/requirements. Throws on failure so the dashboard can
 * show an explicit error state instead of silently rendering zeros.
 */
export async function fetchRequirements(): Promise<Requirement[]> {
  const res = await fetch(`${API_BASE}/jira/requirements`, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to load requirements (${res.status})`);
  }

  return res.json();
}

export async function fetchExecutions(): Promise<TestExecution[]> {
  return fetchApi('/executions');
}

export async function fetchActiveExecutions(): Promise<ActiveExecution[]> {
  return fetchApi('/executions/active');
}

export async function fetchExecutionsTrend(days = 7): Promise<DailyTrend[]> {
  return fetchApi(`/executions/trend?days=${days}`);
}

export async function fetchCoverageSummary(): Promise<CoverageSummary> {
  return fetchApi('/coverage/summary');
}

export async function fetchCoverageByComponent(): Promise<ComponentCoverage[]> {
  return fetchApi('/coverage/by-component');
}

export async function fetchProjects(): Promise<Project[]> {
  return fetchApi('/projects');
}

export async function fetchJiraStatus(): Promise<JiraConnectionStatus> {
  return fetchApi('/jira/status');
}

export async function connectJiraBasic(dto: {
  email: string;
  apiToken: string;
  jiraDomain?: string;
}): Promise<{ success: boolean; siteName: string; projects: Project[] }> {
  return fetchApi('/jira/connect-basic', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function fetchProductStats(): Promise<ProductDashboardStats> {
  return fetchApi('/executions/product-stats');
}

// ── Traceability ─────────────────────────────────────────────────────────────

import type { TestCase, TestCasePriority } from '@qatrack/shared-types';

export async function fetchRequirementById(id: string): Promise<Requirement> {
  return fetchApi(`/jira/requirements/${id}`);
}

export async function fetchLinkedTestCases(requirementId: string): Promise<TestCase[]> {
  return fetchApi(`/jira/requirements/${requirementId}/test-cases`);
}

export async function fetchAvailableTestCases(requirementId: string): Promise<TestCase[]> {
  return fetchApi(`/jira/requirements/${requirementId}/test-cases/available`);
}

export async function linkTestCases(requirementId: string, testCaseIds: string[]): Promise<void> {
  await fetchApi(`/jira/requirements/${requirementId}/test-cases`, {
    method: 'POST',
    body: JSON.stringify({ testCaseIds }),
  });
}

export async function unlinkTestCase(requirementId: string, testCaseId: string): Promise<void> {
  await fetchApi(`/jira/requirements/${requirementId}/test-cases/${testCaseId}`, {
    method: 'DELETE',
  });
}

export async function createTestCase(dto: {
  title: string;
  priority: TestCasePriority;
  tags?: string[];
}): Promise<TestCase> {
  return fetchApi('/jira/test-cases', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function fetchAllTestCases(): Promise<TestCase[]> {
  return fetchApi('/jira/test-cases');
}

export async function createJiraIssue(dto: {
  projectKey?: string;
  summary: string;
  description?: string;
  issueTypeName?: string;
}): Promise<{ id: string; key: string } | null> {
  return fetchApi('/jira/issues', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ── Test Suites & Test Case Management ───────────────────────────────────────

import type { TestSuite, TestApprovalStatus, TestCaseType } from '@qatrack/shared-types';

export async function fetchTestSuites(): Promise<TestSuite[]> {
  return fetchApi('/test-cases/suites');
}

export async function createTestSuite(dto: {
  title: string;
  description: string;
  release?: string;
  productModule?: string;
  requireApproval?: boolean;
  excludeUnapproved?: boolean;
  executionStrategy?: string;
}): Promise<TestSuite> {
  return fetchApi('/test-cases/suites', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateTestSuite(id: string, updates: Partial<TestSuite>): Promise<TestSuite> {
  return fetchApi(`/test-cases/suites/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTestSuite(id: string): Promise<void> {
  await fetchApi(`/test-cases/suites/${id}`, {
    method: 'DELETE',
  });
}

export async function createTestCaseFull(dto: {
  suiteId?: string;
  title: string;
  coverageJiraKey?: string;
  priority: TestCasePriority;
  type?: TestCaseType;
  approvalStatus?: TestApprovalStatus;
  version?: string;
}): Promise<TestCase> {
  return fetchApi('/test-cases', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateTestCase(
  id: string,
  updates: Partial<TestCase>,
): Promise<TestCase> {
  return fetchApi(`/test-cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTestCase(id: string): Promise<void> {
  await fetchApi(`/test-cases/${id}`, {
    method: 'DELETE',
  });
}

// ── Test Plans ────────────────────────────────────────────────────────────────

export type PlanEnvironment = 'Prod' | 'UAT' | 'SIT' | 'Dev';
export type PlanStatus = 'Not Started' | 'In Progress' | 'Completed';

export interface TestPlan {
  id: string;
  name: string;
  description?: string;
  release: string;
  environment: PlanEnvironment;
  status: PlanStatus;
  sprint: string;
  estimatedHours: number;
  suiteIds: string[];
  testCaseIds: string[];
  testCases: TestCase[];
  createdAt: string;
}

export async function fetchTestPlans(): Promise<TestPlan[]> {
  return fetchApi('/test-plans');
}

export async function fetchTestPlanById(id: string): Promise<TestPlan> {
  return fetchApi(`/test-plans/${id}`);
}

export async function fetchAvailableReleases(): Promise<string[]> {
  return fetchApi('/test-plans/releases');
}

export async function createTestPlan(dto: {
  name: string;
  description?: string;
  release: string;
  environment: PlanEnvironment;
  sprint: string;
  estimatedHours: number;
  suiteIds: string[];
}): Promise<TestPlan> {
  return fetchApi('/test-plans', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function updateTestPlan(
  id: string,
  dto: Partial<Omit<TestPlan, 'id' | 'createdAt' | 'testCases' | 'testCaseIds'>>,
): Promise<TestPlan> {
  return fetchApi(`/test-plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export async function updatePlanTestCaseResult(
  planId: string,
  testCaseId: string,
  result: string,
): Promise<TestPlan> {
  return fetchApi(`/test-plans/${planId}/test-cases/${testCaseId}/result`, {
    method: 'PATCH',
    body: JSON.stringify({ result }),
  });
}

export async function deleteTestPlan(id: string): Promise<void> {
  await fetchApi(`/test-plans/${id}`, { method: 'DELETE' });
}

// ── Defects ────────────────────────────────────────────────────────────────

export interface DefectRecord {
  id: string;
  jiraKey: string;
  summary: string;
  description?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'CLOSED';
  assignee?: string;
  projectKey: string;
  createdAt: string;
  linkedTestCaseId?: string;
}

export async function fetchDefects(): Promise<DefectRecord[]> {
  return fetchApi('/jira/defects');
}

export async function updateDefectStatus(
  jiraKey: string,
  status: DefectRecord['status'],
): Promise<DefectRecord> {
  return fetchApi(`/jira/defects/${jiraKey}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function createDefect(dto: {
  summary: string;
  description?: string;
  severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  assignee?: string;
  projectKey?: string;
  linkedTestCaseId?: string;
}): Promise<DefectRecord> {
  return fetchApi('/jira/defects', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ── Admin Settings ─────────────────────────────────────────────────────────

export interface WebhookRecord {
  id: string;
  name: string;
  event: string;
  endpoint: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'QA_LEAD' | 'TESTER' | 'VIEWER';
  status: 'Active' | 'Inactive';
  lastActive: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface GitLabConfig {
  connected: boolean;
  instanceUrl?: string;
  lastSync?: string;
}

export async function syncJiraIssues(projectKey?: string): Promise<Requirement[]> {
  const projects = await fetchProjects();
  const key = projectKey || (projects.length > 0 ? projects[0].key : 'QAT');
  return fetchApi('/jira/sync', {
    method: 'POST',
    body: JSON.stringify({ projectKey: key }),
  });
}

export async function fetchWebhooks(): Promise<WebhookRecord[]> {
  return fetchApi('/settings/webhooks');
}

export async function createWebhook(dto: { name: string; event: string }): Promise<WebhookRecord> {
  return fetchApi('/settings/webhooks', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function toggleWebhook(id: string): Promise<WebhookRecord> {
  return fetchApi(`/settings/webhooks/${id}/toggle`, {
    method: 'PATCH',
  });
}

export async function deleteWebhook(id: string): Promise<void> {
  await fetchApi(`/settings/webhooks/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchUsersList(): Promise<UserRecord[]> {
  return fetchApi('/settings/users');
}

export async function updateUserRole(id: string, role: UserRecord['role']): Promise<UserRecord> {
  return fetchApi(`/settings/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function fetchAuditLogs(): Promise<AuditLogRecord[]> {
  return fetchApi('/settings/audit-logs');
}

export async function fetchGitLabConfig(): Promise<GitLabConfig> {
  return fetchApi('/settings/gitlab');
}

export async function connectGitLab(instanceUrl: string): Promise<GitLabConfig> {
  return fetchApi('/settings/gitlab/connect', {
    method: 'POST',
    body: JSON.stringify({ instanceUrl }),
  });
}

export async function disconnectGitLab(): Promise<GitLabConfig> {
  return fetchApi('/settings/gitlab/disconnect', {
    method: 'POST',
  });
}

// ── Retest & Regression ───────────────────────────────────────────────────

export interface RetestCycle {
  id: string;
  name: string;
  type: 'REGRESSION' | 'RETEST';
  totalCases: number;
  passedCases: number;
  failedCases: number;
  progress: number;
  health: 'HEALTHY' | 'CRITICAL' | 'AT_RISK' | 'IN_PROGRESS';
  owner: string;
  startedAt: string;
}

export async function fetchRetestCycles(): Promise<RetestCycle[]> {
  return fetchApi('/executions/retest-cycles');
}

export async function createRetestCycle(dto: {
  name: string;
  type?: 'REGRESSION' | 'RETEST';
  totalCases?: number;
}): Promise<RetestCycle> {
  return fetchApi('/executions/retest-cycles', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function triggerRetestCycle(id: string): Promise<RetestCycle> {
  return fetchApi(`/executions/retest-cycles/${id}/run`, {
    method: 'POST',
  });
}


