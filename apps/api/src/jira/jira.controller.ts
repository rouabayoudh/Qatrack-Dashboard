import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { JiraService } from './jira.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TestCasePriority } from '@qatrack/shared-types';

@Controller('jira')
export class JiraController {
  // In-memory CSRF store: csrfToken → expiresAt (ms)
  private csrfStates = new Map<string, number>();

  constructor(
    private readonly jiraService: JiraService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Protected endpoints ────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Req() req: any) {
    return this.jiraService.getConnectionStatus(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('requirements')
  getRequirements(@Req() req: any) {
    return this.jiraService.getRequirements(req.user.sub);
  }

  /** GET /jira/requirements/:id — single requirement detail */
  @UseGuards(JwtAuthGuard)
  @Get('requirements/:id')
  getRequirementById(@Req() req: any, @Param('id') id: string) {
    return this.jiraService.getRequirementById(req.user.sub, id);
  }

  /** GET /jira/requirements/:id/test-cases — linked test cases */
  @UseGuards(JwtAuthGuard)
  @Get('requirements/:id/test-cases')
  getLinkedTestCases(@Req() req: any, @Param('id') id: string) {
    return this.jiraService.getLinkedTestCases(req.user.sub, id);
  }

  /** GET /jira/requirements/:id/test-cases/available — test cases not yet linked */
  @UseGuards(JwtAuthGuard)
  @Get('requirements/:id/test-cases/available')
  getAvailableTestCases(@Req() req: any, @Param('id') id: string) {
    return this.jiraService.getAvailableTestCases(req.user.sub, id);
  }

  /** POST /jira/requirements/:id/test-cases — link test cases */
  @UseGuards(JwtAuthGuard)
  @Post('requirements/:id/test-cases')
  linkTestCases(
    @Req() req: any,
    @Param('id') id: string,
    @Body('testCaseIds') testCaseIds: string[],
  ) {
    if (!testCaseIds?.length) {
      throw new BadRequestException('testCaseIds must be a non-empty array');
    }
    this.jiraService.linkTestCases(req.user.sub, id, testCaseIds);
    return { success: true, linked: testCaseIds.length };
  }

  /** DELETE /jira/requirements/:id/test-cases/:tcId — unlink a test case */
  @UseGuards(JwtAuthGuard)
  @Delete('requirements/:id/test-cases/:tcId')
  unlinkTestCase(
    @Req() req: any,
    @Param('id') id: string,
    @Param('tcId') tcId: string,
  ) {
    this.jiraService.unlinkTestCase(req.user.sub, id, tcId);
    return { success: true };
  }

  /** POST /jira/test-cases — create a new test case */
  @UseGuards(JwtAuthGuard)
  @Post('test-cases')
  createTestCase(
    @Req() req: any,
    @Body() body: { title: string; priority: TestCasePriority; tags?: string[] },
  ) {
    if (!body.title) throw new BadRequestException('title is required');
    return this.jiraService.createTestCase(req.user.sub, body);
  }

  /** GET /jira/test-cases — all test cases for the user */
  @UseGuards(JwtAuthGuard)
  @Get('test-cases')
  getAllTestCases(@Req() req: any) {
    return this.jiraService.getAllTestCases(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects')
  async getProjects(@Req() req: any) {
    const userId = req.user.sub;
    const status = this.jiraService.getConnectionStatus(userId);
    if (!status.connected) {
      return [];
    }
    const cached = this.jiraService.getProjects(userId);
    if (cached.length > 0) return cached;
    try {
      return await this.jiraService.fetchAndStoreProjects(userId);
    } catch {
      return [];
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async sync(@Req() req: any, @Body('projectKey') projectKey: string) {
    if (!projectKey) {
      throw new BadRequestException('projectKey is required');
    }
    const userId = req.user.sub;
    const status = this.jiraService.getConnectionStatus(userId);
    if (!status.connected) {
      throw new BadRequestException(
        'Jira is not connected. Please log out and log in again via Jira OAuth.',
      );
    }
    return this.jiraService.syncJiraIssues(userId, projectKey);
  }

  // ── OAuth Login Flow ───────────────────────────────────────────────────────

  @Get('connect')
  connect(@Res() res: Response) {
    const clientId = process.env.JIRA_CLIENT_ID;
    const callbackUrl = process.env.JIRA_CALLBACK_URL;

    if (!clientId) {
      throw new ServiceUnavailableException('JIRA_CLIENT_ID is not set in .env');
    }
    if (!callbackUrl) {
      throw new ServiceUnavailableException('JIRA_CALLBACK_URL is not set in .env');
    }

    const csrfToken = randomBytes(32).toString('hex');
    this.csrfStates.set(csrfToken, Date.now() + 10 * 60 * 1000); // 10 min TTL

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: 'read:jira-work write:jira-work read:jira-user offline_access',
      redirect_uri: callbackUrl,
      state: csrfToken,
      response_type: 'code',
      prompt: 'consent',
    });

    const authUrl = `https://auth.atlassian.com/authorize?${params.toString().replace(/\+/g, '%20')}`;
    console.log('[Jira OAuth] Redirecting to Atlassian authorization URL');
    return res.redirect(authUrl);
  }

  @Get('callback')
  async callback(@Req() req: any, @Res({ passthrough: false }) res: Response) {
    const { code, state } = req.query as { code?: string; state?: string };
    const frontendLogin = 'http://localhost:3000/login';

    try {
      if (!state) throw new Error('Missing state parameter');
      const expiresAt = this.csrfStates.get(state);
      if (!expiresAt || expiresAt < Date.now()) {
        this.csrfStates.delete(state);
        throw new Error('Invalid or expired state parameter');
      }
      this.csrfStates.delete(state);

      if (!code) throw new Error('Missing authorization code');

      console.log('[Jira OAuth] Exchanging code for tokens...');

      const tokens = await this.jiraService.exchangeCodeForTokens(
        code,
        process.env.JIRA_CALLBACK_URL!,
      );

      const site = await this.jiraService.getAccessibleResource(tokens.accessToken);
      console.log(`[Jira OAuth] Connected to site: ${site.name} (${site.cloudId})`);

      const jiraUser = await this.jiraService.getJiraMyself(tokens.accessToken, site.cloudId);
      console.log(`[Jira OAuth] User: ${jiraUser.displayName} <${jiraUser.emailAddress}>`);

      const user = this.jiraService.findOrCreateUser(
        jiraUser.emailAddress,
        jiraUser.displayName,
        jiraUser.accountId,
      );

      this.jiraService.connect(user.id, site.name, site.cloudId, tokens);

      this.jiraService.fetchAndStoreProjects(user.id).catch((err) =>
        console.warn('[Jira OAuth] Background project fetch failed:', err.message),
      );

      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          avatarUrl: jiraUser.avatarUrl,
        },
        { expiresIn: '8h' },
      );

      res.cookie('qatrack_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
      });

      console.log('[Jira OAuth] Login complete → redirecting to dashboard');
      return res.redirect('http://localhost:3000/dashboard');
    } catch (err: any) {
      console.error('[Jira OAuth] Callback error:', err.message || err);
      return res.redirect(`${frontendLogin}?error=jira_auth_failed`);
    }
  }
}
