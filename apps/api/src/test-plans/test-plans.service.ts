import { Injectable, NotFoundException } from '@nestjs/common';
import { TestCase } from '@qatrack/shared-types';
import { JiraService } from '../jira/jira.service';
import { TestCasesService } from '../test-cases/test-cases.service';
import * as fs from 'fs';
import * as path from 'path';

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
  createdAt: string;
}

export interface CreateTestPlanDto {
  name: string;
  description?: string;
  release: string;
  environment: PlanEnvironment;
  sprint: string;
  estimatedHours: number;
  suiteIds: string[];
}

export interface UpdateTestPlanDto {
  name?: string;
  description?: string;
  release?: string;
  environment?: PlanEnvironment;
  status?: PlanStatus;
  sprint?: string;
  estimatedHours?: number;
  suiteIds?: string[];
}

const STORAGE_PATH = path.join(process.cwd(), 'data', 'test_plans_storage.json');

@Injectable()
export class TestPlansService {
  // Keyed by userId -> TestPlan[]
  private userPlans = new Map<string, TestPlan[]>();

  constructor(
    private readonly jiraService: JiraService,
    private readonly testCasesService: TestCasesService,
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
        userPlans: Array.from(this.userPlans.entries()),
      };
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
      console.log('[TestPlansService] Saved test plans state to disk');
    } catch (err: any) {
      console.warn('[TestPlansService] Failed to save test plans state to disk:', err.message);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.userPlans) {
          this.userPlans = new Map(data.userPlans);
        }
        console.log(`[TestPlansService] Restored ${this.userPlans.size} user plan entry set(s) from disk`);
      }
    } catch (err: any) {
      console.warn('[TestPlansService] Failed to load test plans state from disk:', err.message);
    }
  }

  private getOrCreateUserPlans(userId: string): TestPlan[] {
    if (this.userPlans.has(userId)) {
      return this.userPlans.get(userId)!;
    }

    // Fallback search: if this exact userId doesn't have plans yet,
    // check if there are plans under another key (e.g. previous session or single user mode)
    if (this.userPlans.size > 0) {
      for (const [existingKey, plans] of this.userPlans.entries()) {
        if (plans.length > 0) {
          // Adopt existing plans for the new logged-in user ID
          this.userPlans.set(userId, plans);
          this.saveToDisk();
          return plans;
        }
      }
    }

    const initialPlans: TestPlan[] = [];
    this.userPlans.set(userId, initialPlans);
    return initialPlans;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  getPlans(userId: string): TestPlan[] {
    return this.getOrCreateUserPlans(userId);
  }

  getPlanById(userId: string, planId: string): TestPlan {
    const plans = this.getOrCreateUserPlans(userId);
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new NotFoundException(`Test plan "${planId}" not found`);
    return plan;
  }

  createPlan(userId: string, dto: CreateTestPlanDto): TestPlan {
    const plans = this.getOrCreateUserPlans(userId);

    // Collect test case IDs from the selected suites
    const suites = this.testCasesService.getSuites(userId);
    const testCaseIds: string[] = [];
    suites
      .filter((s) => dto.suiteIds.includes(s.id))
      .forEach((s) => s.testCases.forEach((tc) => testCaseIds.push(tc.id)));

    const newPlan: TestPlan = {
      id: `PLAN-${String(plans.length + 1).padStart(3, '0')}`,
      name: dto.name,
      description: dto.description,
      release: dto.release,
      environment: dto.environment,
      status: 'Not Started',
      sprint: dto.sprint,
      estimatedHours: dto.estimatedHours,
      suiteIds: dto.suiteIds,
      testCaseIds,
      createdAt: new Date().toISOString(),
    };

    plans.unshift(newPlan);
    this.userPlans.set(userId, plans);
    this.saveToDisk();
    return newPlan;
  }

  updatePlan(userId: string, planId: string, dto: UpdateTestPlanDto): TestPlan {
    const plans = this.getOrCreateUserPlans(userId);
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx === -1) throw new NotFoundException(`Test plan "${planId}" not found`);

    // If suiteIds changed, refresh testCaseIds
    let testCaseIds = plans[idx].testCaseIds;
    if (dto.suiteIds !== undefined) {
      const suites = this.testCasesService.getSuites(userId);
      testCaseIds = [];
      suites
        .filter((s) => dto.suiteIds!.includes(s.id))
        .forEach((s) => s.testCases.forEach((tc) => testCaseIds.push(tc.id)));
    }

    plans[idx] = { ...plans[idx], ...dto, testCaseIds };
    this.userPlans.set(userId, plans);
    this.saveToDisk();
    return plans[idx];
  }

  deletePlan(userId: string, planId: string): void {
    const plans = this.getOrCreateUserPlans(userId);
    const idx = plans.findIndex((p) => p.id === planId);
    if (idx === -1) throw new NotFoundException(`Test plan "${planId}" not found`);
    plans.splice(idx, 1);
    this.userPlans.set(userId, plans);
    this.saveToDisk();
  }

  // ── Test case result update ───────────────────────────────────────────────

  updateTestCaseResult(
    userId: string,
    planId: string,
    testCaseId: string,
    result: string,
  ): TestPlan {
    const plan = this.getPlanById(userId, planId);

    // Update the actual test case in the suite
    try {
      this.testCasesService.updateTestCase(userId, testCaseId, {
        lastResult: result as any,
      });
    } catch {
      // ignore if not found in suites
    }

    // Recalculate status based on all test cases
    const allCases = this.getTestCasesForPlan(userId, plan);
    const allDone = allCases.length > 0 && allCases.every(
      (tc) => tc.lastResult === 'PASS' || tc.lastResult === 'FAIL' || tc.lastResult === 'BLOCKED',
    );
    const allPassed = allCases.length > 0 && allCases.every((tc) => tc.lastResult === 'PASS');

    if (allPassed) {
      plan.status = 'Completed';
    } else if (allDone || allCases.some((tc) => tc.lastResult !== 'UNTESTED')) {
      plan.status = 'In Progress';
    }

    this.saveToDisk();
    return plan;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Returns hydrated test cases for a plan (merged from suites + jira pool) */
  getTestCasesForPlan(userId: string, plan: TestPlan): TestCase[] {
    const suites = this.testCasesService.getSuites(userId);
    const allSuiteCases = suites
      .filter((s) => plan.suiteIds.includes(s.id))
      .flatMap((s) => s.testCases);

    if (allSuiteCases.length > 0) return allSuiteCases;

    // Fallback: use ids stored on plan from jira pool
    const pool = this.jiraService.getAllTestCases(userId);
    return pool.filter((tc) => plan.testCaseIds.includes(tc.id));
  }

  /** Serializes a plan to the format the frontend expects */
  serializePlan(userId: string, plan: TestPlan) {
    const testCases = this.getTestCasesForPlan(userId, plan);
    return { ...plan, testCases };
  }

  serializePlans(userId: string, plans: TestPlan[]) {
    return plans.map((p) => this.serializePlan(userId, p));
  }

  // ── Jira Sprint / Release data ─────────────────────────────────────────────

  /**
   * Returns unique release versions from the user's synced Jira requirements.
   * These power the "Release" dropdown in the test plans UI.
   */
  getAvailableReleases(userId: string): string[] {
    const reqs = this.jiraService.getRequirements(userId);
    const releases = new Set<string>();
    reqs.forEach((r) => {
      if (r.release && r.release !== 'Unassigned') {
        releases.add(r.release);
      }
    });
    // Also include releases from existing plans
    const plans = this.getOrCreateUserPlans(userId);
    plans.forEach((p) => p.release && releases.add(p.release));
    return Array.from(releases);
  }
}
