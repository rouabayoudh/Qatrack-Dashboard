import { BadRequestException, Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { TestExecution, DailyTrend, ActiveExecution, ProductDashboardStats } from '@qatrack/shared-types';

@Controller('executions')
@UseGuards(JwtAuthGuard)
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get()
  getExecutions(@Request() req: any): TestExecution[] {
    const userId = req.user?.sub || req.user?.userId || '';
    return this.executionsService.getExecutions(userId);
  }

  @Get('active')
  getActiveExecutions(@Request() req: any): ActiveExecution[] {
    const userId = req.user?.sub || req.user?.userId || '';
    return this.executionsService.getActiveExecutions(userId);
  }

  @Get('trend')
  getTrend(@Request() req: any, @Query('days') days?: string): DailyTrend[] {
    const userId = req.user?.sub || req.user?.userId || '';
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.executionsService.getTrend(userId, daysNum);
  }

  @Get('product-stats')
  getProductStats(@Request() req: any): ProductDashboardStats {
    const userId = req.user?.sub || req.user?.userId || '';
    return this.executionsService.getProductStats(userId);
  }

  // ── Retest & Regression Cycles ───────────────────────────────────────────
  @Get('retest-cycles')
  getRetestCycles() {
    return this.executionsService.getRetestCycles();
  }

  @Post('retest-cycles')
  createRetestCycle(@Body() body: { name: string; type: 'REGRESSION' | 'RETEST'; totalCases?: number }) {
    if (!body.name) throw new BadRequestException('name is required');
    return this.executionsService.createRetestCycle({
      name: body.name,
      type: body.type || 'REGRESSION',
      totalCases: body.totalCases,
    });
  }

  @Post('retest-cycles/:id/run')
  triggerRetestCycle(@Param('id') id: string) {
    const res = this.executionsService.triggerRetestCycle(id);
    if (!res) throw new BadRequestException(`Retest cycle ${id} not found`);
    return res;
  }
}
