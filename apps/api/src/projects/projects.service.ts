import { Injectable } from '@nestjs/common';
import { JiraService } from '../jira/jira.service';
import { Project } from '@qatrack/shared-types';

@Injectable()
export class ProjectsService {
  constructor(private readonly jiraService: JiraService) {}

  getProjects(userId: string): Project[] {
    const connection = this.jiraService.getConnectionStatus(userId);
    if (!connection.connected) {
      return [];
    }

    return this.jiraService.getProjects(userId);
  }
}
