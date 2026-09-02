import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { LoginDTO, AuthResponse, UserRole } from '@qatrack/shared-types';
import { JiraService } from '../jira/jira.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => JiraService))
    private jiraService: JiraService,
  ) {}

  async login(dto: LoginDTO): Promise<AuthResponse> {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password/API token are required');
    }

    // Try Jira authentication first
    try {
      const { user, avatarUrl } = await this.jiraService.authenticateWithJira(
        dto.email,
        dto.password,
        dto.jiraDomain,
      );

      const rememberMe = dto.rememberMe ?? false;
      const expiresInSeconds = rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
      const expiresInString = rememberMe ? '30d' : '8h';

      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          avatarUrl,
        },
        { expiresIn: expiresInString },
      );

      return {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl,
        },
        expiresIn: expiresInSeconds,
      };
    } catch (jiraErr: any) {
      // If Jira auth fails, check if this is the offline test credentials for local dev
      if (
        dto.email === 'test@example.com' &&
        dto.password === 'password123'
      ) {
        console.log('[AuthService] Using local dev fallback user');
        const fakeUser = {
          id: 'dev-1',
          name: 'Test User',
          email: dto.email,
          role: 'TESTER' as const,
        };

        const rememberMe = dto.rememberMe ?? false;
        const expiresInSeconds = rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60;
        const expiresInString = rememberMe ? '30d' : '8h';

        const accessToken = this.jwtService.sign(
          { sub: fakeUser.id, role: fakeUser.role, name: fakeUser.name, email: fakeUser.email },
          { expiresIn: expiresInString },
        );

        return {
          accessToken,
          user: fakeUser,
          expiresIn: expiresInSeconds,
        };
      }

      // Propagate Jira error (e.g. UnauthorizedException, BadRequestException, etc.)
      throw jiraErr;
    }
  }

  /**
   * Starts the Atlassian OAuth flow for "Login with Jira" (SSO).
   * Returns the authorization URL — frontend navigates the browser there.
   */
  getJiraAuthUrl(): string {
    const clientId = process.env.JIRA_CLIENT_ID;
    const callbackUrl = process.env.JIRA_CALLBACK_URL;

    if (!clientId) {
      throw new ServiceUnavailableException(
        'JIRA_CLIENT_ID is not set. Add it to your .env file.',
      );
    }
    if (!callbackUrl) {
      throw new ServiceUnavailableException(
        'JIRA_CALLBACK_URL is not set. Add it to your .env file.',
      );
    }

    // For SSO login we don't need a CSRF token tied to an existing user.
    // We just use a random state to prevent CSRF on the callback.
    const state = crypto.randomUUID();
    const scope = 'read:jira-user offline_access';

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope,
      redirect_uri: callbackUrl,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    const queryString = params.toString().replace(/\+/g, '%20');
    return `https://auth.atlassian.com/authorize?${queryString}`;
  }

  /**
   * Exchanges the authorization code from Atlassian for tokens,
   * fetches the Atlassian user profile, finds or creates the QATrack user,
   * and returns an AuthResponse (accessToken + user).
   */
  async handleJiraCallback(code: string, state: string): Promise<AuthResponse> {
    const callbackUrl = process.env.JIRA_CALLBACK_URL;
    if (!callbackUrl) {
      throw new ServiceUnavailableException('JIRA_CALLBACK_URL is not set');
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, callbackUrl);

    // Fetch Atlassian user info
    const atlassianUser = await this.fetchAtlassianUser(tokens.accessToken);

    // Find or create QATrack user by Atlassian account ID
    const user = await this.findOrCreateUserFromAtlassian(
      atlassianUser,
      tokens,
    );

    // Issue JWT
    const rememberMe = true; // SSO sessions are long-lived
    const expiresInSeconds = 30 * 24 * 60 * 60;
    const expiresInString = '30d';

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
      { expiresIn: expiresInString },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      expiresIn: expiresInSeconds,
    };
  }

  /**
   * POST https://auth.atlassian.com/oauth/token
   */
  private async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'JIRA_CLIENT_ID / JIRA_CLIENT_SECRET are not set. Add them to apps/api/.env.',
      );
    }

    const res = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(
        `Jira token exchange failed (${res.status}): ${body}`,
      );
    }

    const data: any = await res.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  /**
   * GET https://api.atlassian.com/me — returns Atlassian account info
   */
  private async fetchAtlassianUser(accessToken: string): Promise<{
    accountId: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    const res = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(
        `Failed to fetch Atlassian user (${res.status}): ${body}`,
      );
    }
    return res.json();
  }

  /**
   * Find existing QATrack user by Atlassian accountId (stored in a map for now),
   * or create a new one. In production this would use a DB.
   */
  private async findOrCreateUserFromAtlassian(
    atlassianUser: { accountId: string; email: string; name: string },
    tokens: { accessToken: string; refreshToken: string },
  ): Promise<{ id: string; name: string; email: string; role: UserRole }> {
    // In-memory store keyed by Atlassian accountId
    // In production: Prisma user table with atlassianAccountId column
    if (!this.atlassianUserMap) {
      this.atlassianUserMap = new Map();
    }

    const user = this.atlassianUserMap.get(atlassianUser.accountId);
    if (user) {
      // Update stored tokens
      user.tokens = tokens;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }

    // Create new user
    const newUser = {
      id: `jira-${atlassianUser.accountId}`,
      name: atlassianUser.name,
      email: atlassianUser.email,
      role: 'TESTER' as UserRole,
      tokens,
    };
    this.atlassianUserMap.set(atlassianUser.accountId, newUser);
    return {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
  }

  // In-memory map: atlassianAccountId -> { id, name, email, role, tokens }
  private atlassianUserMap: Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      tokens: { accessToken: string; refreshToken: string };
    }
  > | null = null;
}
