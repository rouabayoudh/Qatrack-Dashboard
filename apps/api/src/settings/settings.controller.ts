import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Webhooks ─────────────────────────────────────────────────────────────
  @Get('webhooks')
  getWebhooks() {
    return this.settingsService.getWebhooks();
  }

  @Post('webhooks')
  createWebhook(@Body() body: { name: string; event: string }) {
    if (!body.name || !body.event) {
      throw new BadRequestException('name and event are required');
    }
    return this.settingsService.createWebhook(body);
  }

  @Patch('webhooks/:id/toggle')
  toggleWebhook(@Param('id') id: string) {
    const res = this.settingsService.toggleWebhook(id);
    if (!res) throw new NotFoundException('Webhook not found');
    return res;
  }

  @Delete('webhooks/:id')
  deleteWebhook(@Param('id') id: string) {
    this.settingsService.deleteWebhook(id);
    return { success: true };
  }

  // ── Users & Roles ────────────────────────────────────────────────────────
  @Get('users')
  getUsers() {
    return this.settingsService.getUsers();
  }

  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body('role') role: any) {
    const valid = ['ADMIN', 'QA_LEAD', 'TESTER', 'VIEWER'];
    if (!valid.includes(role)) {
      throw new BadRequestException('Invalid user role');
    }
    const res = this.settingsService.updateUserRole(id, role);
    if (!res) throw new NotFoundException('User not found');
    return res;
  }

  // ── Audit Log ────────────────────────────────────────────────────────────
  @Get('audit-logs')
  getAuditLogs() {
    return this.settingsService.getAuditLogs();
  }

  // ── GitLab ───────────────────────────────────────────────────────────────
  @Get('gitlab')
  getGitLabConfig() {
    return this.settingsService.getGitLabConfig();
  }

  @Post('gitlab/connect')
  connectGitLab(@Body('instanceUrl') instanceUrl: string) {
    if (!instanceUrl) throw new BadRequestException('instanceUrl is required');
    return this.settingsService.connectGitLab(instanceUrl);
  }

  @Post('gitlab/disconnect')
  disconnectGitLab() {
    return this.settingsService.disconnectGitLab();
  }
}
