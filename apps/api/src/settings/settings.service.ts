import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface WebhookRecord {
  id: string;
  name: string;
  event: string;
  endpoint: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'QA_LEAD' | 'TESTER' | 'VIEWER';
  status: 'Active' | 'Inactive';
  lastActive: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  ipAddress: string;
}

export interface GitLabConfig {
  connected: boolean;
  instanceUrl?: string;
  lastSync?: string;
}

const STORAGE_PATH = path.join(process.cwd(), 'data', 'settings_storage.json');

@Injectable()
export class SettingsService {
  private webhooks: WebhookRecord[] = [
    {
      id: 'wh-1',
      name: 'GitHub Actions CI',
      event: 'pull_request.merged',
      endpoint: 'https://api.qatrack.io/hooks/v1/gh-ci-928',
      status: 'active',
      createdAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 'wh-2',
      name: 'GitLab MR Pipeline',
      event: 'pipeline.completed',
      endpoint: 'https://api.qatrack.io/hooks/v1/gitlab-mr',
      status: 'active',
      createdAt: '2026-09-12T14:30:00Z',
    },
    {
      id: 'wh-3',
      name: 'Jenkins Daily Build',
      event: 'build.success',
      endpoint: 'https://api.qatrack.io/hooks/v1/jenkins-daily',
      status: 'active',
      createdAt: '2026-09-14T09:15:00Z',
    },
  ];

  private users: UserRecord[] = [
    {
      id: 'usr-1',
      name: 'Roua Bayoudh',
      email: 'roua.bayoudh@qatrack.io',
      role: 'ADMIN',
      status: 'Active',
      lastActive: 'Just now',
    },
    {
      id: 'usr-2',
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@company.com',
      role: 'QA_LEAD',
      status: 'Active',
      lastActive: '2 hours ago',
    },
    {
      id: 'usr-3',
      name: 'David Miller',
      email: 'david.miller@company.com',
      role: 'TESTER',
      status: 'Active',
      lastActive: '1 day ago',
    },
    {
      id: 'usr-4',
      name: 'Alex Thorne',
      email: 'alex.thorne@company.com',
      role: 'VIEWER',
      status: 'Active',
      lastActive: '3 days ago',
    },
  ];

  private auditLogs: AuditLogRecord[] = [
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: 'Roua Bayoudh',
      action: 'JIRA_SYNC_TRIGGERED',
      details: 'Synced requirements and defects from Jira project QAT',
      ipAddress: '192.168.1.45',
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      user: 'Roua Bayoudh',
      action: 'WEBHOOK_CREATED',
      details: 'Created webhook GitHub Actions CI (pull_request.merged)',
      ipAddress: '192.168.1.45',
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      user: 'Sarah Jenkins',
      action: 'DEFECT_STATUS_UPDATE',
      details: 'Updated defect QAT-104 status from OPEN to IN_PROGRESS',
      ipAddress: '192.168.1.88',
    },
    {
      id: 'log-4',
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      user: 'Roua Bayoudh',
      action: 'USER_ROLE_CHANGED',
      details: 'Updated David Miller role to TESTER',
      ipAddress: '192.168.1.45',
    },
  ];

  private gitlabConfig: GitLabConfig = {
    connected: false,
  };

  constructor() {
    this.loadFromDisk();
  }

  private saveToDisk() {
    try {
      const dir = path.dirname(STORAGE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        webhooks: this.webhooks,
        users: this.users,
        auditLogs: this.auditLogs,
        gitlabConfig: this.gitlabConfig,
      };
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[SettingsService] Failed to save state to disk:', err.message);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(STORAGE_PATH)) {
        const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (data.webhooks) this.webhooks = data.webhooks;
        if (data.users) this.users = data.users;
        if (data.auditLogs) this.auditLogs = data.auditLogs;
        if (data.gitlabConfig) this.gitlabConfig = data.gitlabConfig;
        console.log('[SettingsService] Restored settings state from disk');
      }
    } catch (err: any) {
      console.warn('[SettingsService] Failed to load state from disk:', err.message);
    }
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────
  getWebhooks(): WebhookRecord[] {
    return this.webhooks;
  }

  createWebhook(dto: { name: string; event: string }): WebhookRecord {
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newWebhook: WebhookRecord = {
      id: `wh-${Date.now()}`,
      name: dto.name,
      event: dto.event,
      endpoint: `https://api.qatrack.io/hooks/v1/${slug}-${Math.floor(100 + Math.random() * 900)}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.webhooks.unshift(newWebhook);
    this.addAuditLog('Roua Bayoudh', 'WEBHOOK_CREATED', `Created incoming webhook "${dto.name}"`);
    this.saveToDisk();
    return newWebhook;
  }

  toggleWebhook(id: string): WebhookRecord | null {
    const item = this.webhooks.find((w) => w.id === id);
    if (!item) return null;
    item.status = item.status === 'active' ? 'inactive' : 'active';
    this.saveToDisk();
    return item;
  }

  deleteWebhook(id: string): void {
    const item = this.webhooks.find((w) => w.id === id);
    this.webhooks = this.webhooks.filter((w) => w.id !== id);
    if (item) {
      this.addAuditLog('Roua Bayoudh', 'WEBHOOK_DELETED', `Deleted webhook "${item.name}"`);
    }
    this.saveToDisk();
  }

  // ── Users ────────────────────────────────────────────────────────────────
  getUsers(): UserRecord[] {
    return this.users;
  }

  updateUserRole(id: string, role: UserRecord['role']): UserRecord | null {
    const user = this.users.find((u) => u.id === id);
    if (!user) return null;
    const oldRole = user.role;
    user.role = role;
    this.addAuditLog('Roua Bayoudh', 'USER_ROLE_CHANGED', `Changed role for ${user.name} from ${oldRole} to ${role}`);
    this.saveToDisk();
    return user;
  }

  // ── Audit Logs ───────────────────────────────────────────────────────────
  getAuditLogs(): AuditLogRecord[] {
    return this.auditLogs;
  }

  addAuditLog(user: string, action: string, details: string, ipAddress = '192.168.1.45'): AuditLogRecord {
    const log: AuditLogRecord = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      details,
      ipAddress,
    };
    this.auditLogs.unshift(log);
    this.saveToDisk();
    return log;
  }

  // ── GitLab ───────────────────────────────────────────────────────────────
  getGitLabConfig(): GitLabConfig {
    return this.gitlabConfig;
  }

  connectGitLab(instanceUrl: string): GitLabConfig {
    this.gitlabConfig = {
      connected: true,
      instanceUrl,
      lastSync: new Date().toISOString(),
    };
    this.addAuditLog('Roua Bayoudh', 'GITLAB_CONNECTED', `Connected GitLab instance at ${instanceUrl}`);
    this.saveToDisk();
    return this.gitlabConfig;
  }

  disconnectGitLab(): GitLabConfig {
    this.gitlabConfig = { connected: false };
    this.addAuditLog('Roua Bayoudh', 'GITLAB_DISCONNECTED', 'Disconnected GitLab integration');
    this.saveToDisk();
    return this.gitlabConfig;
  }
}
