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
   * Returns coverage percentage grouped by component or product.
   * If requirements don't have an explicit component, uses the Jira Project Key.
   */
  getByComponent(userId: string): ComponentCoverage[] {
    const requirements = this.jiraService.getRequirements(userId);
    const projects = this.jiraService.getProjects(userId);

    if (!requirements || requirements.length === 0) {
      // If projects exist but no issues have been synced yet, list projects with 0% coverage
      if (projects && projects.length > 0) {
        return projects.map((p) => ({
          component: p.name || p.key,
          coveragePercent: 0,
        }));
      }
      return [];
    }

    // Group by component or project
    const groups: Record<string, Requirement[]> = {};
    for (const req of requirements) {
      const projKey = req.jiraIssueKey ? req.jiraIssueKey.split('-')[0] : 'QATrack Core';
      const comp = req.component || projKey || 'Core Module';
      if (!groups[comp]) {
        groups[comp] = [];
      }
      groups[comp].push(req);
    }

    // Calculate coverage percent per component
    const result = Object.entries(groups).map(([component, reqs]) => {
      const verifiedCount = reqs.filter((r) =>
        ['Done', 'Closed', 'Resolved'].includes(r.status),
      ).length;
      const coveragePercent = Math.round((verifiedCount / reqs.length) * 100);
      return { component, coveragePercent };
    });

    return result;
  }
}
