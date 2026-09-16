import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JiraModule } from './jira/jira.module';
import { ExecutionsModule } from './executions/executions.module';
import { CoverageModule } from './coverage/coverage.module';
import { ProjectsModule } from './projects/projects.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { TestPlansModule } from './test-plans/test-plans.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    AuthModule,
    JiraModule,
    ExecutionsModule,
    CoverageModule,
    ProjectsModule,
    TestCasesModule,
    TestPlansModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
