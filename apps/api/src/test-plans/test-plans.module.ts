import { Module } from '@nestjs/common';
import { TestPlansController } from './test-plans.controller';
import { TestPlansService } from './test-plans.service';
import { JiraModule } from '../jira/jira.module';
import { TestCasesModule } from '../test-cases/test-cases.module';

@Module({
  imports: [JiraModule, TestCasesModule],
  controllers: [TestPlansController],
  providers: [TestPlansService],
  exports: [TestPlansService],
})
export class TestPlansModule {}
