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
    const userId = req.user?.sub || req.user?.id || req.user?.userId || '';
    return this.coverageService.getSummary(userId);
  }

  @Get('by-component')
  getByComponent(@Req() req: any): ComponentCoverage[] {
    const userId = req.user?.sub || req.user?.id || req.user?.userId || '';
    return this.coverageService.getByComponent(userId);
  }
}
