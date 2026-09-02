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

@Injectable()
export class TestCasesService {
  // Keyed by userId -> TestSuite[]
  private userSuites = new Map<string, TestSuite[]>();
  // Keyed by userId -> TestCase[] (for standalone test cases not in any suite)
  private userStandaloneCases = new Map<string, TestCase[]>();

  constructor(
    @Inject(forwardRef(() => JiraService))
    private readonly jiraService: JiraService,
  ) {}

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

  createSuite(userId: string, dto: { title: string; description: string; release?: string }): TestSuite {
    const suites = this.getOrCreateUserSuites(userId);
    const newSuite: TestSuite = {
      id: `suite-${Date.now()}`,
      title: dto.title,
      description: dto.description,
      release: dto.release || 'Current Release',
      testCases: [],
    };
    suites.push(newSuite);
    this.userSuites.set(userId, suites);
    return newSuite;
  }

  createTestCase(
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
  ): TestCase {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    const totalCount =
      suites.reduce((acc, s) => acc + s.testCases.length, 0) + standalone.length;

    const newTestCase: TestCase = {
      id: `TC-${1000 + totalCount + 1}`,
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

    return newTestCase;
  }

  updateTestCase(userId: string, testCaseId: string, updates: Partial<TestCase>): TestCase {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    // Search in suites
    for (const suite of suites) {
      const tcIndex = suite.testCases.findIndex((t) => t.id === testCaseId);
      if (tcIndex !== -1) {
        suite.testCases[tcIndex] = {
          ...suite.testCases[tcIndex],
          ...updates,
          updatedAt: 'Just now',
        };
        this.jiraService.registerTestCase(userId, suite.testCases[tcIndex]);
        return suite.testCases[tcIndex];
      }
    }

    // Search in standalone
    const standaloneIndex = standalone.findIndex((t) => t.id === testCaseId);
    if (standaloneIndex !== -1) {
      standalone[standaloneIndex] = {
        ...standalone[standaloneIndex],
        ...updates,
        updatedAt: 'Just now',
      };
      this.jiraService.registerTestCase(userId, standalone[standaloneIndex]);
      return standalone[standaloneIndex];
    }

    throw new NotFoundException(`Test case ${testCaseId} not found`);
  }

  deleteTestCase(userId: string, testCaseId: string): void {
    const suites = this.getOrCreateUserSuites(userId);
    const standalone = this.getOrCreateStandaloneCases(userId);

    for (const suite of suites) {
      const tcIndex = suite.testCases.findIndex((t) => t.id === testCaseId);
      if (tcIndex !== -1) {
        suite.testCases.splice(tcIndex, 1);
        return;
      }
    }

    const standaloneIndex = standalone.findIndex((t) => t.id === testCaseId);
    if (standaloneIndex !== -1) {
      standalone.splice(standaloneIndex, 1);
      return;
    }

    throw new NotFoundException(`Test case ${testCaseId} not found`);
  }
}
