import { Injectable, Inject, forwardRef } from '@nestjs/common';
import type { TestExecution, DailyTrend, ActiveExecution, ProductDashboardStats } from '@qatrack/shared-types';
import { JiraService } from '../jira/jira.service';
import * as fs from 'fs';
import * as path from 'path';

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

const STORAGE_PATH = path.join(process.cwd(), 'data', 'retest_storage.json');
const CLOSED_STATUSES = new Set(['Done', 'Closed', 'Resolved']);

@Injectable()
export class ExecutionsService {
  private retestCycles: RetestCycle[] = [
    {
      id: 'CYC-882',
      name: 'v2.4.0 Hotfix Regression',
      type: 'REGRESSION',
      totalCases: 450,
      passedCases: 380,
      failedCases: 20,
      progress: 72,
      health: 'CRITICAL',
      owner: 'Sarah Jenkins',
      startedAt: '2 hours ago',
    },
    {
      id: 'CYC-881',
      name: 'Stable Main Build Retest',
      type: 'RETEST',
      totalCases: 1200,
      passedCases: 1180,
      failedCases: 20,
      progress: 98,
      health: 'HEALTHY',
      owner: 'Automation Runner',
      startedAt: '5 hours ago',
    },
    {
      id: 'CYC-880',
      name: 'Payment Gateway Regression',
      type: 'REGRESSION',
      totalCases: 120,
      passedCases: 54,
      failedCases: 66,
      progress: 45,
      health: 'CRITICAL',
      owner: 'David Miller',
      startedAt: '1 day ago',
    },
    {
      id: 'CYC-879',
      name: 'UI Component Library Check',
      type: 'RETEST',
      totalCases: 85,
      passedCases: 10,
      failedCases: 0,
      progress: 12,
      health: 'IN_PROGRESS',
      owner: 'Alex Thorne',
      startedAt: 'Just now',
    },
    {
      id: 'CYC-878',
      name: 'Mobile App End-to-End',
      type: 'REGRESSION',
      totalCases: 210,
      passedCases: 198,
      failedCases: 12,
      progress: 92,
      health: 'HEALTHY',
      owner: 'Sarah Jenkins',
      startedAt: '3 days ago',
    },
  ];

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
      fs.writeFileSync(STORAGE_PATH, JSON.stringify({ retestCycles: this.retestCycles }, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[ExecutionsService] Failed to save retest cycles to disk:', err.message);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.retestCycles) this.retestCycles = data.retestCycles;
        console.log('[ExecutionsService] Restored retest cycles from disk');
      }
    } catch (err: any) {
      console.warn('[ExecutionsService] Failed to load retest cycles from disk:', err.message);
    }
  }

  // ── Retest Cycles API ─────────────────────────────────────────────────────

  getRetestCycles(): RetestCycle[] {
    return this.retestCycles;
  }

  createRetestCycle(dto: { name: string; type: 'REGRESSION' | 'RETEST'; totalCases?: number; owner?: string }): RetestCycle {
    const nextNum = 883 + this.retestCycles.length;
    const newCycle: RetestCycle = {
      id: `CYC-${nextNum}`,
      name: dto.name,
      type: dto.type,
      totalCases: dto.totalCases || 150,
      passedCases: 0,
      failedCases: 0,
      progress: 0,
      health: 'IN_PROGRESS',
      owner: dto.owner || 'Alex River',
      startedAt: 'Just now',
    };
    this.retestCycles.unshift(newCycle);
    this.saveToDisk();
    return newCycle;
  }

  triggerRetestCycle(id: string): RetestCycle | null {
    const item = this.retestCycles.find((c) => c.id === id);
    if (!item) return null;
    item.progress = Math.min(100, item.progress + 15);
    item.passedCases = Math.floor((item.progress / 100) * item.totalCases);
    if (item.progress >= 100) {
      item.health = item.failedCases > 30 ? 'CRITICAL' : 'HEALTHY';
    } else {
      item.health = 'IN_PROGRESS';
    }
    this.saveToDisk();
    return item;
  }

  // ── Original Executions API ───────────────────────────────────────────────

  getExecutions(userId?: string): TestExecution[] {
    if (!userId) return [];
    const requirements = this.jiraService.getRequirements(userId);
    if (!requirements || requirements.length === 0) {
      return [];
    }

    const groups: Record<string, typeof requirements> = {};
    for (const r of requirements) {
      const key = r.component || r.jiraIssueKey.split('-')[0] || 'Core Module';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    const executions: TestExecution[] = [];
    let idx = 8290;

    for (const [suiteName, reqs] of Object.entries(groups)) {
      const completed = reqs.filter((r) => CLOSED_STATUSES.has(r.status ?? '')).length;
      const total = reqs.length;
      const passPercent = total > 0 ? Math.round((completed / total) * 100) : 100;
      const hasOpenBugs = reqs.some((r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''));

      let status: 'PASSED' | 'FAILED' | 'UNSTABLE' = 'PASSED';
      if (passPercent < 75 || hasOpenBugs) {
        status = passPercent < 50 ? 'FAILED' : 'UNSTABLE';
      }

      executions.push({
        id: `TR-${idx++}`,
        suiteName: `${suiteName} Verification Suite`,
        status,
        passPercent,
        durationSeconds: Math.floor(120 + Math.random() * 300),
        startedAt: new Date(Date.now() - 1000 * 60 * (executions.length * 45 + 15)).toISOString(),
      });
    }

    return executions;
  }

  getActiveExecutions(userId?: string): ActiveExecution[] {
    if (!userId) return [];
    const projects = this.jiraService.getProjects(userId);
    if (!projects || projects.length === 0) {
      return [];
    }
    return projects.slice(0, 2).map((p, index) => ({
      id: `RUN-${101 + index}`,
      suiteName: `Live Suite - ${p.name || p.key}`,
      startedAt: new Date(Date.now() - 1000 * 60 * (index * 7 + 5)).toISOString(),
      runnerInitials: 'QA',
    }));
  }

  getTrend(userId: string, days: number): DailyTrend[] {
    const requirements = userId ? this.jiraService.getRequirements(userId) : [];
    const total = requirements.length;
    const closed = requirements.filter((r) => CLOSED_STATUSES.has(r.status ?? '')).length;
    const openBugs = requirements.filter((r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? '')).length;

    const trend: DailyTrend[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      trend.push({
        date: dateStr,
        passCount: total > 0 ? Math.max(0, closed - i) : 0,
        failCount: total > 0 ? Math.min(openBugs, i + 1) : 0,
      });
    }
    return trend;
  }

  getProductStats(userId?: string): ProductDashboardStats {
    if (!userId) {
      return {
        lastPassRate: 0,
        passRateChange: 0,
        requirementCoverage: 0,
        coverageChange: 0,
        openDefects: 0,
        defectsTrend: 'No synced data',
        flakyTests: 0,
        passRateTrend: [0, 0, 0, 0, 0],
        coverageTrend: [0, 0, 0, 0, 0],
        qualityHighlights: [{ type: 'good', text: 'No Jira issues synced yet.' }],
        projectRows: [],
      };
    }

    const requirements = this.jiraService.getRequirements(userId);
    const projects = this.jiraService.getProjects(userId);

    if (!requirements || requirements.length === 0) {
      return {
        lastPassRate: 0,
        passRateChange: 0,
        requirementCoverage: 0,
        coverageChange: 0,
        openDefects: 0,
        defectsTrend: '0 active',
        flakyTests: 0,
        passRateTrend: [0, 0, 0, 0, 0],
        coverageTrend: [0, 0, 0, 0, 0],
        qualityHighlights: [
          { type: 'good', text: 'Connect & Sync Jira to fetch real project metrics.' },
        ],
        projectRows: projects.map((p) => ({
          name: p.name || p.key,
          tests: 0,
          status: 'Healthy',
          lastRun: 'Not run',
        })),
      };
    }

    const totalReqs = requirements.length;
    const completedReqs = requirements.filter((r) => CLOSED_STATUSES.has(r.status ?? '')).length;
    const openBugs = requirements.filter((r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''));
    const criticalBugs = openBugs.filter(
      (b) =>
        b.priority?.toUpperCase() === 'CRITICAL' ||
        b.priority?.toUpperCase() === 'HIGH' ||
        b.priority?.toUpperCase() === 'BLOCKER',
    );

    const coveragePercent = Math.round((completedReqs / totalReqs) * 100);
    const passRate = Math.min(100, Math.max(0, Math.round(((totalReqs - openBugs.length) / totalReqs) * 100)));

    const projectRows = projects.map((p) => {
      const pReqs = requirements.filter((r) => r.jiraIssueKey.startsWith(`${p.key}-`));
      const pBugs = pReqs.filter((r) => r.type === 'BUG' && !CLOSED_STATUSES.has(r.status ?? ''));
      let status: 'Healthy' | 'At Risk' | 'Critical' = 'Healthy';
      if (pBugs.length > 2) status = 'Critical';
      else if (pBugs.length > 0) status = 'At Risk';

      return {
        name: p.name || p.key,
        tests: pReqs.length,
        status,
        lastRun: 'Recent',
      };
    });

    const highlights: { type: 'good' | 'bad'; text: string }[] = [];
    highlights.push({
      type: 'good',
      text: `Requirements coverage is ${coveragePercent}% across ${totalReqs} Jira items`,
    });
    highlights.push({
      type: 'good',
      text: `${completedReqs} of ${totalReqs} requirements verified in current sprint`,
    });
    if (criticalBugs.length > 0) {
      highlights.push({
        type: 'bad',
        text: `${criticalBugs.length} critical defect(s) currently open in Jira`,
      });
    } else {
      highlights.push({
        type: 'good',
        text: 'Zero critical defects open in Jira',
      });
    }
    if (openBugs.length > 0) {
      highlights.push({
        type: 'bad',
        text: `${openBugs.length} total open defect(s) tracking across projects`,
      });
    }

    return {
      lastPassRate: passRate,
      passRateChange: 0,
      requirementCoverage: coveragePercent,
      coverageChange: 0,
      openDefects: openBugs.length,
      defectsTrend: `${openBugs.length} active`,
      flakyTests: 0,
      passRateTrend: [Math.max(0, passRate - 20), Math.max(0, passRate - 15), Math.max(0, passRate - 10), Math.max(0, passRate - 5), passRate],
      coverageTrend: [Math.max(0, coveragePercent - 30), Math.max(0, coveragePercent - 20), Math.max(0, coveragePercent - 10), Math.max(0, coveragePercent - 5), coveragePercent],
      qualityHighlights: highlights,
      projectRows,
    };
  }
}
