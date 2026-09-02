import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TestExecution, DailyTrend, ActiveExecution } from '@qatrack/shared-types';

@Controller('executions')
@UseGuards(JwtAuthGuard)
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  getExecutions(): TestExecution[] {
    return this.executionsService.getExecutions();
  }

  @Get('active')
  getActiveExecutions(): ActiveExecution[] {
    return this.executionsService.getActiveExecutions();
  }

  @Get('trend')
  getTrend(@Query('days') days?: string): DailyTrend[] {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.executionsService.getTrend(daysNum);
  }
}
