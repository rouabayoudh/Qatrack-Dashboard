import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestCasesService } from './test-cases.service';
import {
  TestCasePriority,
  TestCaseResult,
  TestApprovalStatus,
  TestCaseType,
} from '@qatrack/shared-types';

@Controller('test-cases')
@UseGuards(JwtAuthGuard)
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

  @Get('suites')
  getSuites(@Req() req: any) {
    return this.testCasesService.getSuites(req.user.sub);
  }

  @Post('suites')
  createSuite(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      description: string;
      release?: string;
      productModule?: string;
      requireApproval?: boolean;
      excludeUnapproved?: boolean;
      executionStrategy?: string;
    },
  ) {
    if (!body.title) {
      throw new BadRequestException('Suite title is required');
    }
    return this.testCasesService.createSuite(req.user.sub, body);
  }

  @Put('suites/:id')
  updateSuite(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.testCasesService.updateSuite(req.user.sub, id, body);
  }

  @Delete('suites/:id')
  deleteSuite(@Req() req: any, @Param('id') id: string) {
    this.testCasesService.deleteSuite(req.user.sub, id);
    return { success: true };
  }

  @Post()
  createTestCase(
    @Req() req: any,
    @Body()
    body: {
      suiteId?: string;
      title: string;
      coverageJiraKey?: string;
      priority: TestCasePriority;
      type?: TestCaseType;
      approvalStatus?: TestApprovalStatus;
      version?: string;
      lastResult?: TestCaseResult;
    },
  ) {
    if (!body.title) {
      throw new BadRequestException('Test case title is required');
    }
    return this.testCasesService.createTestCase(req.user.sub, body);
  }

  @Put(':id')
  updateTestCase(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.testCasesService.updateTestCase(req.user.sub, id, body);
  }

  @Delete(':id')
  deleteTestCase(@Req() req: any, @Param('id') id: string) {
    this.testCasesService.deleteTestCase(req.user.sub, id);
    return { success: true };
  }
}
