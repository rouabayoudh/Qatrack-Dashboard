import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestPlansService } from './test-plans.service';
import type { CreateTestPlanDto, UpdateTestPlanDto } from './test-plans.service';

@UseGuards(JwtAuthGuard)
@Controller('test-plans')
export class TestPlansController {
  constructor(private readonly testPlansService: TestPlansService) {}

  /** GET /test-plans — list all plans (with hydrated test cases) */
  @Get()
  getPlans(@Req() req: any) {
    const plans = this.testPlansService.getPlans(req.user.sub);
    return this.testPlansService.serializePlans(req.user.sub, plans);
  }

  /** GET /test-plans/releases — available release versions from Jira */
  @Get('releases')
  getReleases(@Req() req: any) {
    return this.testPlansService.getAvailableReleases(req.user.sub);
  }

  /** GET /test-plans/:id — single plan with hydrated test cases */
  @Get(':id')
  getPlanById(@Req() req: any, @Param('id') id: string) {
    const plan = this.testPlansService.getPlanById(req.user.sub, id);
    return this.testPlansService.serializePlan(req.user.sub, plan);
  }

  /** POST /test-plans — create a new plan */
  @Post()
  createPlan(@Req() req: any, @Body() dto: CreateTestPlanDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('name is required');
    }
    const plan = this.testPlansService.createPlan(req.user.sub, dto);
    return this.testPlansService.serializePlan(req.user.sub, plan);
  }

  /** PUT /test-plans/:id — update a plan */
  @Put(':id')
  updatePlan(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTestPlanDto,
  ) {
    const plan = this.testPlansService.updatePlan(req.user.sub, id, dto);
    return this.testPlansService.serializePlan(req.user.sub, plan);
  }

  /** PATCH /test-plans/:id/test-cases/:tcId/result — update a test case result */
  @Patch(':id/test-cases/:tcId/result')
  updateTestCaseResult(
    @Req() req: any,
    @Param('id') planId: string,
    @Param('tcId') tcId: string,
    @Body('result') result: string,
  ) {
    if (!result) throw new BadRequestException('result is required');
    const plan = this.testPlansService.updateTestCaseResult(
      req.user.sub,
      planId,
      tcId,
      result,
    );
    return this.testPlansService.serializePlan(req.user.sub, plan);
  }

  /** DELETE /test-plans/:id — delete a plan */
  @Delete(':id')
  deletePlan(@Req() req: any, @Param('id') id: string) {
    this.testPlansService.deletePlan(req.user.sub, id);
    return { success: true };
  }
}
