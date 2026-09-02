import { Module } from '@nestjs/common';
import { CoverageController } from './coverage.controller';
import { CoverageService } from './coverage.service';
import { AuthModule } from '../auth/auth.module';
import { JiraModule } from '../jira/jira.module';

@Module({
  imports: [AuthModule, JiraModule],
  controllers: [CoverageController],
  providers: [CoverageService],
  exports: [CoverageService],
})
export class CoverageModule {}
