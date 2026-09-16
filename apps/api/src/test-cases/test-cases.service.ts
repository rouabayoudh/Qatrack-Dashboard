import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import {
  TestSuite,
  TestCase,
  TestCasePriority,
  TestCaseResult,
  TestApprovalStatus,
  TestCaseType,
} from '@qatrack/shared-types';
import { JiraService } from '../jira/jira.service';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'data', 'test_cases_storage.json');

@Injectable()
export class TestCasesService {
  // Keyed by userId -> TestSuite[]
  private userSuites = new Map<string, TestSuite[]>();
  // Keyed by userId -> TestCase[] (for standalone test cases not in any suite)
  private userStandaloneCases = new Map<string, TestCase[]>();

  constructor(
    @Inject(forwardRef(() => JiraService))
    private readonly jiraService: JiraService,
  ) {
    this.loadFromDisk();
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        userSuites: Array.from(this.userSuites.entries()),
        userStandaloneCases: Array.from(this.userStandaloneCases.entries()),
      };
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[TestCasesService] Failed to save test cases state to disk:', err.message);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.userSuites) this.userSuites = new Map(data.userSuites);
        if (data.userStandaloneCases) this.userStandaloneCases = new Map(data.userStandaloneCases);
        console.log('[TestCasesService] Restored test cases state from disk');
      }
    } catch (err: any) {
      console.warn('[TestCasesService] Failed to load test cases state from disk:', err.message);
    }
  }

  private getOrCreateUserSuites(userId: string): TestSuite[] {
    if (!this.userSuites.has(userId)) {
      this.userSuites.set(userId, []);
    }
    return this.userSuites.get(userId)!;
  }

  private getOrCreateStandaloneCases(userId: string): TestCase[] {
    if (!this.userStandaloneCases.has(userId)) {
      this.userStandaloneCases.set(userId, []);
    }
    return this.userStandaloneCases.get(userId)!;
  }

  getSuites(userId: string): TestSuite[] {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    // If there are standalone test cases, represent them in a dedicated suite group so they render cleanly
    if (standalone.length > 0) {
      const existingStandaloneSuite = suites.find((s) => s.id === 'standalone');
      if (existingStandaloneSuite) {
        existingStandaloneSuite.testCases = standalone;
        return suites;
      }
      return [
        ...suites,
        {
          id: 'standalone',
          title: 'Standalone Test Cases',
          description: 'Test cases created without an assigned test suite',
          release: 'Unassigned',
          testCases: standalone,
        },
      ];
    }

    return suites.filter((s) => s.id !== 'standalone');
  }

  async createSuite(
    userId: string,
    dto: {
      title: string;
      description: string;
      release?: string;
      productModule?: string;
      requireApproval?: boolean;
      excludeUnapproved?: boolean;
      executionStrategy?: string;
    },
  ): Promise<TestSuite> {
    const suites = this.getOrCreateUserSuites(userId);
    const newSuite: TestSuite = {
      id: `suite-${Date.now()}`,
      title: dto.title,
      description: dto.description,
      release: dto.release || 'v2.4.0-stable',
      productModule: dto.productModule || 'E-Commerce App / Checkout',
      requireApproval: dto.requireApproval ?? true,
      excludeUnapproved: dto.excludeUnapproved ?? true,
      executionStrategy: dto.executionStrategy || 'Sequential (Order by ID)',
      testCases: [],
    };

    // Try posting to real Jira REST API if user is connected
    const projectKey = this.jiraService.getActiveProjectKey(userId);
    if (projectKey) {
      const jiraResult = await this.jiraService.createJiraIssue(userId, {
        projectKey,
        summary: `[Test Suite] ${dto.title}`,
        description: dto.description,
        issueTypeName: 'Task',
      });
      if (jiraResult) {
        newSuite.id = jiraResult.key;
      }
    }

    suites.push(newSuite);
    this.userSuites.set(userId, suites);
    this.saveToDisk();
    return newSuite;
  }

  updateSuite(userId: string, suiteId: string, updates: Partial<TestSuite>): TestSuite {
    const suites = this.getOrCreateUserSuites(userId);
    const index = suites.findIndex((s) => s.id === suiteId);
    if (index === -1) {
      throw new NotFoundException(`Suite ${suiteId} not found`);
    }
    suites[index] = {
      ...suites[index],
      ...updates,
    };
    this.saveToDisk();
    return suites[index];
  }

  deleteSuite(userId: string, suiteId: string): void {
    const suites = this.getOrCreateUserSuites(userId);
    const index = suites.findIndex((s) => s.id === suiteId);
    if (index !== -1) {
      suites.splice(index, 1);
      this.saveToDisk();
    }
  }

  async createTestCase(
    userId: string,
    dto: {
      suiteId?: string;
      title: string;
      coverageJiraKey?: string;
      priority: TestCasePriority;
      type?: TestCaseType;
      approvalStatus?: TestApprovalStatus;
      version?: string;
      lastResult?: TestCaseResult;
    },
  ): Promise<TestCase> {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    const totalCount =
      suites.reduce((acc, s) => acc + s.testCases.length, 0) + standalone.length;

    let testCaseId = `TC-${1000 + totalCount + 1}`;

    // Extract project key from coverageJiraKey or active project
    let projectKey = this.jiraService.getActiveProjectKey(userId);
    if (dto.coverageJiraKey && dto.coverageJiraKey.includes('-')) {
      projectKey = dto.coverageJiraKey.split('-')[0];
    }

    if (projectKey) {
      const jiraResult = await this.jiraService.createJiraIssue(userId, {
        projectKey,
        summary: `[Test Case] ${dto.title}`,
        description: `Priority: ${dto.priority || 'MEDIUM'} | Type: ${dto.type || 'FUNCTIONAL'} ${dto.coverageJiraKey ? `| Covered Requirement: ${dto.coverageJiraKey}` : ''}`,
        issueTypeName: 'Task',
        parentKey: dto.coverageJiraKey && dto.coverageJiraKey.startsWith(projectKey) ? dto.coverageJiraKey : undefined,
      });
      if (jiraResult) {
        testCaseId = jiraResult.key;
      }
    }

    const newTestCase: TestCase = {
      id: testCaseId,
      suiteId: dto.suiteId && dto.suiteId !== 'standalone' && dto.suiteId !== '' ? dto.suiteId : undefined,
      title: dto.title,
      coverageJiraKey: dto.coverageJiraKey,
      priority: dto.priority || 'MEDIUM',
      type: dto.type || 'FUNCTIONAL',
      approvalStatus: dto.approvalStatus || 'DRAFT',
      version: dto.version || 'v1',
      lastResult: dto.lastResult || 'UNTESTED',
      updatedAt: 'Just now',
    };

    if (newTestCase.suiteId) {
      const targetSuite = suites.find((s) => s.id === newTestCase.suiteId);
      if (targetSuite) {
        targetSuite.testCases.push(newTestCase);
      } else {
        // Fallback to standalone if specified suite doesn't exist
        newTestCase.suiteId = undefined;
        standalone.push(newTestCase);
      }
    } else {
      // Completely optional suite - saved as standalone
      standalone.push(newTestCase);
    }

    // Register in JiraService pool and link if coverage Jira key was provided
    this.jiraService.registerTestCase(userId, newTestCase);
    if (dto.coverageJiraKey) {
      this.jiraService.linkTestCaseByKey(userId, dto.coverageJiraKey, newTestCase.id);
    }

    this.saveToDisk();
    return newTestCase;
  }

  updateTestCase(userId: string, testCaseId: string, updates: Partial<TestCase>): TestCase {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    let updatedTC: TestCase | null = null;

    // Search in suites
    for (const suite of suites) {
      const tcIndex = suite.testCases.findIndex((t) => t.id === testCaseId);
      if (tcIndex !== -1) {
        suite.testCases[tcIndex] = {
          ...suite.testCases[tcIndex],
          ...updates,
          updatedAt: 'Just now',
        };
        updatedTC = suite.testCases[tcIndex];
        break;
      }
    }

    // Search in standalone if not in suite
    if (!updatedTC) {
      const standaloneIndex = standalone.findIndex((t) => t.id === testCaseId);
      if (standaloneIndex !== -1) {
        standalone[standaloneIndex] = {
          ...standalone[standaloneIndex],
          ...updates,
          updatedAt: 'Just now',
        };
        updatedTC = standalone[standaloneIndex];
      }
    }

    if (!updatedTC) {
      throw new NotFoundException(`Test case ${testCaseId} not found`);
    }

    this.jiraService.registerTestCase(userId, updatedTC);
    this.saveToDisk();

    // If lastResult changed and testCaseId or coverageJiraKey is a Jira issue key, post comment to Jira
    if (updates.lastResult) {
      const targetJiraKey = updatedTC.coverageJiraKey || (updatedTC.id.includes('-') ? updatedTC.id : null);
      if (targetJiraKey) {
        this.jiraService.addJiraIssueComment(
          userId,
          targetJiraKey,
          `[QATrack Execution Update] Test Case ${updatedTC.id} (${updatedTC.title}) status changed to: ${updates.lastResult}`,
        ).catch(() => {});
      }
    }

    return updatedTC;
  }

  deleteTestCase(userId: string, testCaseId: string): void {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    for (const suite of suites) {
      const tcIndex = suite.testCases.findIndex((t) => t.id === testCaseId);
      if (tcIndex !== -1) {
        suite.testCases.splice(tcIndex, 1);
        this.saveToDisk();
        return;
      }
    }

    const standaloneIndex = standalone.findIndex((t) => t.id === testCaseId);
    if (standaloneIndex !== -1) {
      standalone.splice(standaloneIndex, 1);
      this.saveToDisk();
      return;
    }

    throw new NotFoundException(`Test case ${testCaseId} not found`);
  }
}
