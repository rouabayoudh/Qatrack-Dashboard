import { Module, forwardRef } from '@nestjs/common';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { AuthModule } from '../auth/auth.module';
import { JiraModule } from '../jira/jira.module';

@Module({
  imports: [AuthModule, forwardRef(() => JiraModule)],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}

