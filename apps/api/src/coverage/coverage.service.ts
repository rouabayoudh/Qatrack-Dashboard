import { Injectable } from '@nestjs/common';
import { JiraService } from '../jira/jira.service';
import { CoverageSummary, ComponentCoverage, Requirement } from '@qatrack/shared-types';

@Injectable()
export class CoverageService {
  constructor(private readonly jiraService: JiraService) {}

  /**
   * Calculates overall requirement coverage.
   * Coverage is calculated as the percentage of requirements that are completed (Done, Closed, Resolved).
   * Returns zero values when no requirements have been synced from Jira yet.
   */
  getSummary(userId: string): CoverageSummary {
    const requirements = this.jiraService.getRequirements(userId);
    if (!requirements || requirements.length === 0) {
      return {
        coveragePercent: 0,
        changeFromLastWeek: 0,
      };
    }

    const verifiedCount = requirements.filter((r) =>
      ['Done', 'Closed', 'Resolved'].includes(r.status),
    ).length;

    const coveragePercent = Math.round((verifiedCount / requirements.length) * 100);

    return {
      coveragePercent,
      changeFromLastWeek: 0,
    };
  }

  /**
   * Returns coverage percentage grouped by component.
   * Requirements without a component fall under "Uncategorized".
   * Returns an empty array when no requirements have been synced from Jira yet.
   */
  getByComponent(userId: string): ComponentCoverage[] {
    const requirements = this.jiraService.getRequirements(userId);
    if (!requirements || requirements.length === 0) {
      return [];
    }

    // Group by component
    const groups: Record<string, Requirement[]> = {};
    for (const req of requirements) {
      const comp = req.component || 'Uncategorized';
      if (!groups[comp]) {
        groups[comp] = [];
      }
      groups[comp].push(req);
    }

    // Calculate coverage percent per component
    return Object.entries(groups).map(([component, reqs]) => {
      const verifiedCount = reqs.filter((r) =>
        ['Done', 'Closed', 'Resolved'].includes(r.status),
      ).length;
      const coveragePercent = Math.round((verifiedCount / reqs.length) * 100);
      return { component, coveragePercent };
    });
  }
}
