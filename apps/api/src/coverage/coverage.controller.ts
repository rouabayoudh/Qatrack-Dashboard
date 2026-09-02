import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CoverageService } from './coverage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CoverageSummary, ComponentCoverage } from '@qatrack/shared-types';

@Controller('coverage')
@UseGuards(JwtAuthGuard)
export class CoverageController {
  constructor(private readonly coverageService: CoverageService) {}

  @Get('summary')
  getSummary(@Req() req: any): CoverageSummary {
    return this.coverageService.getSummary(req.user.sub);
  }

  @Get('by-component')
  getByComponent(@Req() req: any): ComponentCoverage[] {
    return this.coverageService.getByComponent(req.user.sub);
  }
}
