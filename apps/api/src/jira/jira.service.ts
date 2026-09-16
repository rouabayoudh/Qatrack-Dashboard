import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  JiraConnectionStatus,
  Requirement,
  RequirementType,
  TestCase,
  TestCasePriority,
  TestCaseResult,
  TraceabilityLink,
  UserRole,
  Project,
} from '@qatrack/shared-types';

import * as fs from 'fs';
import * as path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'data', 'jira_storage.json');

// Per-user Jira session: OAuth tokens or Basic Auth credentials + site info
export interface JiraSession {
  authType: 'oauth' | 'basic';
  accessToken?: string;
  refreshToken?: string;
  cloudId?: string;
  siteName: string;
  jiraHost?: string;
  basicAuth?: string;
}

export interface DefectRecord {
  id: string;
  jiraKey: string;
  summary: string;
  description?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'IN_PROGRESS' | 'READY_FOR_RETEST' | 'CLOSED';
  assignee?: string;
  projectKey: string;
  createdAt: string;
  linkedTestCaseId?: string;
}

@Injectable()
export class JiraService {
  // In-memory stores keyed by QATrack user ID
  private connections    = new Map<string, JiraConnectionStatus>();
  private sessions       = new Map<string, JiraSession>();
  private requirements   = new Map<string, Requirement[]>();
  private userProjects   = new Map<string, Project[]>();
  private testCases      = new Map<string, TestCase[]>();
  private traceLinks     = new Map<string, TraceabilityLink[]>();
  private defects        = new Map<string, DefectRecord[]>();
  private users          = new Map<
    string,
    { id: string; email: string; name: string; role: UserRole; jiraAccountId: string }
  >();

  constructor() {
    this.loadFromDisk();
  }

  public saveToDisk() {
    try {
      const dir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        connections: Array.from(this.connections.entries()),
        sessions: Array.from(this.sessions.entries()),
        requirements: Array.from(this.requirements.entries()),
        userProjects: Array.from(this.userProjects.entries()),
        testCases: Array.from(this.testCases.entries()),
        traceLinks: Array.from(this.traceLinks.entries()),
        defects: Array.from(this.defects.entries()),
        users: Array.from(this.users.entries()),
      };
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[JiraService] Failed to save state to disk:', err.message);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.connections) this.connections = new Map(data.connections);
        if (data.sessions) this.sessions = new Map(data.sessions);
        if (data.requirements) this.requirements = new Map(data.requirements);
        if (data.userProjects) this.userProjects = new Map(data.userProjects);
        if (data.testCases) this.testCases = new Map(data.testCases);
        if (data.traceLinks) this.traceLinks = new Map(data.traceLinks);
        if (data.defects) this.defects = new Map(data.defects);
        if (data.users) this.users = new Map(data.users);
        console.log('[JiraService] Restored state from disk');
      }
    } catch (err: any) {
      console.warn('[JiraService] Failed to load state from disk:', err.message);
    }
  }

  /** Returns all stored defects for a user with session key fallback */
  getDefects(userId: string): DefectRecord[] {
    const direct = this.defects.get(userId);
    if (direct && direct.length > 0) return direct;

    for (const [key, list] of this.defects.entries()) {
      if (list && list.length > 0) {
        this.defects.set(userId, list);
        this.saveToDisk();
        return list;
      }
    }
    return direct || [];
  }

  /** Creates and persists a defect record locally, attempting Jira post if connected */
  async createDefect(
    userId: string,
    dto: {
      summary: string;
      description?: string;
      severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      assignee?: string;
      projectKey?: string;
      linkedTestCaseId?: string;
    },
  ): Promise<DefectRecord> {
    const list = this.getDefects(userId);
    const projKey = dto.projectKey || this.getActiveProjectKey(userId) || 'QAT';
    
    // Attempt real Jira issue post if user has session
    let jiraKey = '';
    let jiraId = '';
    try {
      const created = await this.createJiraIssue(userId, {
        projectKey: projKey,
        summary: dto.summary,
        description: dto.description,
        issueTypeName: 'Bug',
      });
      if (created?.key) {
        jiraKey = created.key;
        jiraId = created.id;
      }
    } catch {
      // Ignore Jira errors, fallback to local defect record
    }

    if (!jiraKey) {
      const nextNum = 100 + list.length + 1;
      jiraKey = `${projKey}-${nextNum}`;
      jiraId = `local-def-${Date.now()}`;
    }

    // Check if duplicate jiraKey already exists in list (avoid duplicate entries)
    const existingIdx = list.findIndex((d) => d.jiraKey === jiraKey);
    const newRecord: DefectRecord = {
      id: jiraId,
      jiraKey,
      summary: dto.summary,
      description: dto.description,
      severity: dto.severity || 'HIGH',
      status: 'OPEN',
      assignee: dto.assignee,
      projectKey: projKey,
      createdAt: new Date().toISOString(),
      linkedTestCaseId: dto.linkedTestCaseId,
    };

    if (existingIdx >= 0) {
      list[existingIdx] = newRecord;
    } else {
      list.unshift(newRecord);
    }

    this.defects.set(userId, list);
    this.saveToDisk();
    return newRecord;
  }

  /** Updates the status of a stored defect */
  updateDefectStatus(userId: string, jiraKey: string, status: DefectRecord['status']): DefectRecord | null {
    const list = this.getDefects(userId);
    const idx = list.findIndex((d) => d.jiraKey === jiraKey);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], status };
    this.defects.set(userId, list);
    this.saveToDisk();
    return list[idx];
  }

  // ── User management ────────────────────────────────────────────────────────

  findOrCreateUser(
    email: string,
    name: string,
    jiraAccountId: string,
  ): { id: string; email: string; name: string; role: UserRole } {
    const existing = this.users.get(email);
    if (existing) {
      return { id: existing.id, email: existing.email, name: existing.name, role: existing.role };
    }
    const newUser = {
      id: `jira-${jiraAccountId}`,
      email,
      name,
      role: 'VIEWER' as UserRole,
      jiraAccountId,
    };
    this.users.set(email, newUser);
    console.log(`[JiraService] New user: ${newUser.id} (${email})`);
    return { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role };
  }

  // ── Connection management ──────────────────────────────────────────────────

  getConnectionStatus(userId: string): JiraConnectionStatus {
    return this.connections.get(userId) || { connected: false };
  }

  /** Called after OAuth callback — stores tokens + site info for this user */
  connectOAuth(
    userId: string,
    siteName: string,
    cloudId: string,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    this.sessions.set(userId, { authType: 'oauth', ...tokens, cloudId, siteName });
    this.connections.set(userId, {
      connected: true,
      siteName,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  /** Called when user logs in with email + Jira API Token / password */
  connectBasic(
    userId: string,
    siteName: string,
    jiraHost: string,
    basicAuth: string,
  ) {
    this.sessions.set(userId, {
      authType: 'basic',
      siteName,
      jiraHost,
      basicAuth,
    });
    this.connections.set(userId, {
      connected: true,
      siteName,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  /** Alias for backward compatibility */
  connect(
    userId: string,
    siteName: string,
    cloudId: string,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    this.connectOAuth(userId, siteName, cloudId, tokens);
  }

  /**
   * Authenticates user against Jira using email and API token / password (Basic Auth).
   * Verifies credentials against Jira's /rest/api/3/myself endpoint, returns user info and registers the session.
   */
  async authenticateWithJira(
    email: string,
    apiTokenOrPassword: string,
    rawDomain?: string,
  ): Promise<{
    user: { id: string; email: string; name: string; role: UserRole };
    avatarUrl?: string;
    siteName: string;
  }> {
    const domain = (
      rawDomain ||
      process.env.JIRA_HOST ||
      process.env.JIRA_DOMAIN ||
      ''
    ).trim();

    if (!domain) {
      throw new BadRequestException(
        'Jira domain is required (e.g. your-company.atlassian.net). You can enter it on login or set JIRA_HOST in .env.',
      );
    }

    // Format Jira host URL
    let jiraHost = domain;
    if (!jiraHost.startsWith('http://') && !jiraHost.startsWith('https://')) {
      jiraHost = `https://${jiraHost.includes('.') ? jiraHost : `${jiraHost}.atlassian.net`}`;
    }
    // Remove trailing slash
    jiraHost = jiraHost.replace(/\/+$/, '');

    const siteName = jiraHost.replace(/^https?:\/\//, '');
    const basicAuth = `Basic ${Buffer.from(`${email.trim()}:${apiTokenOrPassword.trim()}`).toString('base64')}`;

    console.log(`[JiraService] Authenticating with Jira at ${jiraHost} for ${email}...`);

    let res: globalThis.Response;
    try {
      // Try Jira v3 API first
      res = await fetch(`${jiraHost}/rest/api/3/myself`, {
        headers: {
          Authorization: basicAuth,
          Accept: 'application/json',
        },
      });

      // Fallback to Jira v2 API if v3 is not found (e.g. Jira Server / Data Center)
      if (res.status === 404) {
        res = await fetch(`${jiraHost}/rest/api/2/myself`, {
          headers: {
            Authorization: basicAuth,
            Accept: 'application/json',
          },
        });
      }
    } catch (err: any) {
      console.error('[JiraService] Network error connecting to Jira:', err.message || err);
      throw new ServiceUnavailableException(
        `Unable to reach Jira at ${jiraHost}. Please verify the domain and your network connection.`,
      );
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException(
          'Invalid Jira credentials. Note: For Jira Cloud accounts, generate an API Token from your Atlassian account security settings and use it as your password.',
        );
      }
      const errText = await res.text().catch(() => '');
      throw new BadRequestException(`Jira authentication failed (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const accountId = data.accountId || data.name || data.key || email;
    const displayName = data.displayName || data.name || email.split('@')[0];
    const emailAddress = data.emailAddress || email;
    const avatarUrl = data.avatarUrls?.['48x48'] || data.avatarUrls?.['32x32'];

    const user = this.findOrCreateUser(emailAddress, displayName, accountId);
    this.connectBasic(user.id, siteName, jiraHost, basicAuth);

    // Fetch projects in background
    this.fetchAndStoreProjects(user.id).catch((err) =>
      console.warn('[JiraService] Background project fetch after basic auth failed:', err.message),
    );

    console.log(`[JiraService] Jira basic login successful: ${user.name} (${user.email}) connected to ${siteName}`);
    return { user, avatarUrl, siteName };
  }

  /** Returns the stored Jira session for API calls, or throws if not connected */
  private getSession(userId: string): JiraSession {
    const session = this.sessions.get(userId);
    if (!session) {
      throw new UnauthorizedException(
        'Jira not connected for this user. Please log in with your Jira account.',
      );
    }
    return session;
  }

  // ── Atlassian OAuth token exchange ─────────────────────────────────────────

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('JIRA_CLIENT_ID / JIRA_CLIENT_SECRET not set.');
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
      throw new BadRequestException(
        `Jira token exchange failed (${res.status}): ${await res.text()}`,
      );
    }
    const data: any = await res.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  // ── Atlassian REST API helpers ─────────────────────────────────────────────

  async getAccessibleResource(
    accessToken: string,
  ): Promise<{ cloudId: string; name: string; url: string }> {
    const res = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
    );
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to get accessible resources (${res.status}): ${await res.text()}`,
      );
    }
    const resources: any[] = await res.json();
    if (!resources.length) {
      throw new BadRequestException('No accessible Jira sites found for this account.');
    }
    const site = resources[0];
    return {
      cloudId: site.id,
      name: site.name || site.url?.replace(/^https?:\/\//, '') || 'atlassian.net',
      url: site.url,
    };
  }

  async getJiraMyself(
    accessToken: string,
    cloudId: string,
  ): Promise<{ accountId: string; emailAddress: string; displayName: string; avatarUrl?: string }> {
    const res = await fetch(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
    );
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to get Jira user info (${res.status}): ${await res.text()}`,
      );
    }
    const data: any = await res.json();
    return {
      accountId: data.accountId,
      emailAddress: data.emailAddress,
      displayName: data.displayName,
      avatarUrl: data.avatarUrls?.['32x32'] || data.avatarUrls?.['48x48'],
    };
  }

  // ── Real Jira API: Projects ────────────────────────────────────────────────

  async fetchAndStoreProjects(userId: string): Promise<Project[]> {
    const session = this.getSession(userId);
    const isBasic = session.authType === 'basic';
    const baseUrl = isBasic
      ? session.jiraHost
      : `https://api.atlassian.com/ex/jira/${session.cloudId}`;
    const authHeader = isBasic
      ? session.basicAuth!
      : `Bearer ${session.accessToken}`;

    let res = await fetch(`${baseUrl}/rest/api/3/project`, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    if (res.status === 404 && isBasic) {
      res = await fetch(`${baseUrl}/rest/api/2/project`, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
    }

    if (!res.ok) {
      throw new BadRequestException(
        `Failed to fetch Jira projects (${res.status}): ${await res.text()}`,
      );
    }
    const data: any[] = await res.json();

    const projects: Project[] = data.map((p: any) => ({
      id: p.id,
      key: p.key,
      name: p.name,
    }));

    this.userProjects.set(userId, projects);
    console.log(`[JiraService] Fetched ${projects.length} projects for user ${userId}`);
    return projects;
  }

  getRequirements(userId: string): Requirement[] {
    const direct = this.requirements.get(userId);
    if (direct && direct.length > 0) return direct;

    for (const [key, list] of this.requirements.entries()) {
      if (list && list.length > 0) {
        this.requirements.set(userId, list);
        this.saveToDisk();
        return list;
      }
    }
    return direct || [];
  }

  getProjects(userId: string): Project[] {
    const direct = this.userProjects.get(userId);
    if (direct && direct.length > 0) return direct;

    for (const [key, list] of this.userProjects.entries()) {
      if (list && list.length > 0) {
        this.userProjects.set(userId, list);
        this.saveToDisk();
        return list;
      }
    }
    return direct || [];
  }

  // ── Requirement by ID ──────────────────────────────────────────────────────

  getRequirementById(userId: string, id: string): Requirement {
    const reqs = this.getRequirements(userId);
    const req = reqs.find((r) => r.id === id || r.jiraIssueKey === id);
    if (!req) {
      throw new NotFoundException(`Requirement "${id}" not found`);
    }
    return req;
  }

  // ── Traceability: Test Cases ───────────────────────────────────────────────

  private getOrCreateUserTestCases(userId: string): TestCase[] {
    if (!this.testCases.has(userId)) {
      if (this.testCases.size > 0) {
        for (const [key, list] of this.testCases.entries()) {
          if (list && list.length > 0) {
            this.testCases.set(userId, list);
            return list;
          }
        }
      }
      this.testCases.set(userId, []);
    }
    return this.testCases.get(userId)!;
  }

  async syncJiraIssues(userId: string, projectKey: string): Promise<Requirement[]> {
    const session = this.getSession(userId);
    const isBasic = session.authType === 'basic';
    const baseUrl = isBasic
      ? session.jiraHost
      : `https://api.atlassian.com/ex/jira/${session.cloudId}`;
    const authHeader = isBasic
      ? session.basicAuth!
      : `Bearer ${session.accessToken}`;

    const jql = `project = "${projectKey}" ORDER BY created DESC`;
    const fields = ['summary', 'status', 'issuetype', 'components', 'parent', 'priority', 'assignee', 'description', 'fixVersions', 'versions'];
    const url = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields.join(',')}&maxResults=100`;

    let res = await fetch(url, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    // Fallback to GET /rest/api/3/search if search/jql returns 404
    if (res.status === 404) {
      const searchUrl = `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=${fields.join(',')}&maxResults=100`;
      res = await fetch(searchUrl, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
    }

    // Fallback to POST if GET is not available
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      const postUrl = `${baseUrl}/rest/api/3/search`;
      res = await fetch(postUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ jql, fields, maxResults: 100 }),
      });
    }

    // Fallback to v2 if v3 is not found
    if (res.status === 404 && isBasic) {
      const v2Url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields.join(',')}&maxResults=100`;
      res = await fetch(v2Url, {
        headers: { Authorization: authHeader, Accept: 'application/json' },
      });
    }

    if (!res.ok) {
      throw new BadRequestException(
        `Failed to fetch Jira issues for project ${projectKey} (${res.status}): ${await res.text()}`,
      );
    }
    const data: any = await res.json();
    const issues: any[] = data.issues || [];

    const requirements: Requirement[] = issues.map((issue: any) => ({
      id: issue.id,
      jiraIssueKey: issue.key,
      title: issue.fields.summary,
      type: this.mapIssueType(issue.fields.issuetype?.name),
      status: issue.fields.status?.name ?? 'Unknown',
      parentEpicKey: issue.fields.parent?.key,
      component: issue.fields.components?.[0]?.name ?? undefined,
      priority: issue.fields.priority?.name ?? undefined,
      assignee: issue.fields.assignee?.displayName ?? undefined,
      release: issue.fields.fixVersions?.[0]?.name ?? issue.fields.versions?.[0]?.name ?? undefined,
      description: issue.fields.description
        ? (typeof issue.fields.description === 'string'
            ? issue.fields.description
            : issue.fields.description?.content?.[0]?.content?.[0]?.text ?? '')
        : undefined,
    }));

    // Merge: keep other projects' data
    const existing = this.requirements.get(userId) || [];
    const existingFromOtherProjects = existing.filter(
      (r) => !r.jiraIssueKey.startsWith(`${projectKey}-`),
    );
    const merged = [...existingFromOtherProjects, ...requirements];
    this.requirements.set(userId, merged);

    // Ensure synced project is in the list
    const projects = this.userProjects.get(userId) || [];
    if (!projects.some((p) => p.key === projectKey)) {
      projects.push({ id: `proj-${projectKey}`, key: projectKey, name: projectKey });
      this.userProjects.set(userId, projects);
    }

    // Update lastSyncedAt
    const conn = this.getConnectionStatus(userId);
    if (conn.connected) {
      this.connections.set(userId, { ...conn, lastSyncedAt: new Date().toISOString() });
    }

    console.log(`[JiraService] Synced ${requirements.length} issues from ${projectKey} for user ${userId}`);
    return requirements;
  }

  private mapIssueType(issueTypeName: string): RequirementType {
    const name = (issueTypeName || '').toLowerCase();
    if (name === 'epic') return 'EPIC';
    if (name === 'bug') return 'BUG';
    if (name === 'task' || name === 'sub-task' || name === 'subtask') return 'TASK';
    return 'STORY';
  }

  // ── Requirement by ID & Traceability ─────────────────────────────────────

  /** Returns all test cases created by this user (global pool) */
  getAllTestCases(userId: string): TestCase[] {
    return this.getOrCreateUserTestCases(userId);
  }

  /** Returns test cases linked to the given requirement */
  getLinkedTestCases(userId: string, requirementId: string): TestCase[] {
    const all = this.getOrCreateUserTestCases(userId);
    const links = this.traceLinks.get(userId) || [];
    const linked = new Set(
      links.filter((l) => l.requirementId === requirementId).map((l) => l.testCaseId),
    );
    return all.filter((tc) => linked.has(tc.id));
  }

  /** Returns test cases NOT yet linked to the given requirement */
  getAvailableTestCases(userId: string, requirementId: string): TestCase[] {
    const all = this.getOrCreateUserTestCases(userId);
    const links = this.traceLinks.get(userId) || [];
    const linked = new Set(
      links.filter((l) => l.requirementId === requirementId).map((l) => l.testCaseId),
    );
    return all.filter((tc) => !linked.has(tc.id));
  }

  /** Links one or more test cases to a requirement */
  linkTestCases(userId: string, requirementId: string, testCaseIds: string[]): void {
    // Verify requirement exists
    this.getRequirementById(userId, requirementId);

    const existing = this.traceLinks.get(userId) || [];
    const alreadyLinked = new Set(
      existing.filter((l) => l.requirementId === requirementId).map((l) => l.testCaseId),
    );
    const newLinks: TraceabilityLink[] = testCaseIds
      .filter((id) => !alreadyLinked.has(id))
      .map((testCaseId) => ({ requirementId, testCaseId }));

    this.traceLinks.set(userId, [...existing, ...newLinks]);
    console.log(`[JiraService] Linked ${newLinks.length} test cases to requirement ${requirementId}`);
  }

  /** Unlinks a single test case from a requirement */
  unlinkTestCase(userId: string, requirementId: string, testCaseId: string): void {
    const links = this.traceLinks.get(userId) || [];
    this.traceLinks.set(
      userId,
      links.filter((l) => !(l.requirementId === requirementId && l.testCaseId === testCaseId)),
    );
  }

  /** Registers or updates a test case in the user's pool */
  registerTestCase(userId: string, tc: TestCase): void {
    const all = this.getOrCreateUserTestCases(userId);
    const existingIndex = all.findIndex((t) => t.id === tc.id);
    if (existingIndex !== -1) {
      all[existingIndex] = tc;
    } else {
      all.push(tc);
    }
    this.testCases.set(userId, all);
  }

  /** Links a test case by requirement key or ID */
  linkTestCaseByKey(userId: string, requirementKeyOrId: string, testCaseId: string): void {
    const reqs = this.requirements.get(userId) || [];
    const req = reqs.find((r) => r.id === requirementKeyOrId || r.jiraIssueKey === requirementKeyOrId);
    if (!req) return;

    const existing = this.traceLinks.get(userId) || [];
    const alreadyLinked = existing.some(
      (l) => (l.requirementId === req.id || l.requirementId === req.jiraIssueKey) && l.testCaseId === testCaseId,
    );
    if (!alreadyLinked) {
      existing.push({ requirementId: req.id, testCaseId });
      this.traceLinks.set(userId, existing);
      console.log(`[JiraService] Auto-linked test case ${testCaseId} to requirement ${req.jiraIssueKey}`);
    }
  }

  /** Creates a new test case in the user's pool */
  createTestCase(userId: string, dto: { title: string; priority: TestCasePriority; tags?: string[] }): TestCase {
    const all = this.getOrCreateUserTestCases(userId);
    const next = all.length + 1;
    const tc: TestCase = {
      id: `TC-${String(next).padStart(3, '0')}`,
      title: dto.title,
      priority: dto.priority,
      lastResult: 'UNTESTED',
      tags: dto.tags ?? [],
    };
    all.push(tc);
    this.testCases.set(userId, all);
    this.saveToDisk();
    return tc;
  }

  // ── Active Project & Real Jira Issue Creation ─────────────────────────────

  getActiveProjectKey(userId: string): string | null {
    const projects = this.userProjects.get(userId) || [];
    if (projects.length > 0) {
      return projects[0].key;
    }
    const reqs = this.requirements.get(userId) || [];
    if (reqs.length > 0) {
      const match = reqs[0].jiraIssueKey.match(/^([A-Z0-9]+)-/);
      if (match) return match[1];
    }
    return null;
  }

  /** Posts and creates a real issue in the user's Jira account via Jira REST API */
  async createJiraIssue(
    userId: string,
    dto: {
      projectKey: string;
      summary: string;
      description?: string;
      issueTypeName?: string;
      parentKey?: string;
    },
  ): Promise<{ id: string; key: string } | null> {
    try {
      const session = this.sessions.get(userId);
      if (!session) return null;

      const isBasic = session.authType === 'basic';
      const baseUrl = isBasic
        ? session.jiraHost
        : `https://api.atlassian.com/ex/jira/${session.cloudId}`;
      const authHeader = isBasic
        ? session.basicAuth!
        : `Bearer ${session.accessToken}`;

      const body = {
        fields: {
          project: { key: dto.projectKey },
          summary: dto.summary,
          issuetype: { name: dto.issueTypeName || 'Task' },
          ...(dto.description
            ? {
                description: {
                  type: 'doc',
                  version: 1,
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: dto.description }],
                    },
                  ],
                },
              }
            : {}),
          ...(dto.parentKey ? { parent: { key: dto.parentKey } } : {}),
        },
      };

      console.log(`[JiraService] Creating Jira issue "${dto.summary}" in project ${dto.projectKey}...`);

      let res = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Fallback for Jira v2 API or different schema
        const v2Body = {
          fields: {
            project: { key: dto.projectKey },
            summary: dto.summary,
            description: dto.description || '',
            issuetype: { name: dto.issueTypeName || 'Task' },
          },
        };
        res = await fetch(`${baseUrl}/rest/api/2/issue`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(v2Body),
        });
      }

      if (res.ok) {
        const data: any = await res.json();
        console.log(`[JiraService] Successfully created Jira issue ${data.key} for user ${userId}`);
        // Store defect locally for the Defects page
        const defectList = this.defects.get(userId) || [];
        defectList.unshift({
          id: data.id,
          jiraKey: data.key,
          summary: dto.summary,
          description: dto.description,
          severity: 'HIGH',
          status: 'OPEN',
          projectKey: dto.projectKey,
          createdAt: new Date().toISOString(),
        });
        this.defects.set(userId, defectList);
        this.saveToDisk();
        return { id: data.id, key: data.key };
      } else {
        const errText = await res.text().catch(() => '');
        console.warn(`[JiraService] Jira issue creation failed (${res.status}): ${errText}`);
      }
    } catch (err: any) {
      console.warn(`[JiraService] Error creating issue in Jira:`, err.message || err);
    }
    return null;
  }

  /** Adds an execution result comment to a Jira issue */
  async addJiraIssueComment(
    userId: string,
    issueKey: string,
    commentText: string,
  ): Promise<boolean> {
    try {
      const session = this.sessions.get(userId);
      if (!session) return false;

      const isBasic = session.authType === 'basic';
      const baseUrl = isBasic
        ? session.jiraHost
        : `https://api.atlassian.com/ex/jira/${session.cloudId}`;
      const authHeader = isBasic
        ? session.basicAuth!
        : `Bearer ${session.accessToken}`;

      const body = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: commentText }],
            },
          ],
        },
      };

      let res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const v2Body = { body: commentText };
        res = await fetch(`${baseUrl}/rest/api/2/issue/${issueKey}/comment`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(v2Body),
        });
      }

      if (res.ok) {
        console.log(`[JiraService] Added execution comment to Jira issue ${issueKey}`);
        this.saveToDisk();
        return true;
      }
    } catch (err: any) {
      console.warn(`[JiraService] Error adding comment to Jira issue ${issueKey}:`, err.message || err);
    }
    return false;
  }
}
