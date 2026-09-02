import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JiraModule } from '../jira/jira.module';

const jwtModule = JwtModule.register({
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  signOptions: { expiresIn: '8h' },
});

@Module({
  imports: [jwtModule, forwardRef(() => JiraModule)],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [jwtModule, AuthService],
})
export class AuthModule {}
