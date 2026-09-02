import { Injectable } from '@nestjs/common';
import { TestExecution, DailyTrend, ActiveExecution } from '@qatrack/shared-types';

@Injectable()
export class ExecutionsService {
  private executions: TestExecution[] = [];

  private activeExecutions: ActiveExecution[] = [];

  getExecutions(): TestExecution[] {
    return this.executions;
  }

  getActiveExecutions(): ActiveExecution[] {
    return this.activeExecutions;
  }

  getTrend(days: number): DailyTrend[] {
    const trend: DailyTrend[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      trend.push({ date: dateStr, passCount: 0, failCount: 0 });
    }
    return trend;
  }
}
