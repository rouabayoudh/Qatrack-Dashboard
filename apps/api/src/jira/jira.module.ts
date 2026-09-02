import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JiraController } from './jira.controller';
import { JiraService } from './jira.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [JiraController],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}
