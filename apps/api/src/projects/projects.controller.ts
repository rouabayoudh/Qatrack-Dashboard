import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Project } from '@qatrack/shared-types';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  getProjects(@Req() req: any): Project[] {
    return this.projectsService.getProjects(req.user.sub);
  }
}
