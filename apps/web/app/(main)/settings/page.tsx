'use client';

import { useEffect, useState } from 'react';
import {
  fetchJiraStatus,
  syncJiraIssues,
  fetchWebhooks,
  createWebhook,
  toggleWebhook,
  deleteWebhook,
  fetchUsersList,
  updateUserRole,
  fetchAuditLogs,
  fetchGitLabConfig,
  connectGitLab,
  disconnectGitLab,
  type JiraConnectionStatus,
  type WebhookRecord,
  type UserRecord,
  type AuditLogRecord,
  type GitLabConfig,
} from '@/lib/api';
import { ConnectJiraModal } from '../dashboard/components/ConnectJiraModal';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'integrations' | 'users' | 'audit'>('integrations');

  // State
  const [jiraStatus, setJiraStatus] = useState<JiraConnectionStatus>({ connected: false });
  const [gitlabConfig, setGitlabConfig] = useState<GitLabConfig>({ connected: false });
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [syncingJira, setSyncingJira] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [isGitLabModalOpen, setIsGitLabModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Form states
  const [gitlabUrl, setGitlabUrl] = useState('https://gitlab.com');
  const [webhookName, setWebhookName] = useState('');
  const [webhookEvent, setWebhookEvent] = useState('pull_request.merged');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jira, gitlab, wh, usr, logs] = await Promise.all([
        fetchJiraStatus().catch(() => ({ connected: false })),
        fetchGitLabConfig().catch(() => ({ connected: false })),
        fetchWebhooks().catch(() => []),
        fetchUsersList().catch(() => []),
        fetchAuditLogs().catch(() => []),
      ]);
      setJiraStatus(jira);
      setGitlabConfig(gitlab);
      setWebhooks(wh);
      setUsers(usr);
      setAuditLogs(logs);
    } catch (err: any) {
      console.error('Failed loading settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncJira = async () => {
    setSyncingJira(true);
    setFeedbackMsg(null);
    try {
      await syncJiraIssues();
      const updated = await fetchJiraStatus();
      setJiraStatus(updated);
      setFeedbackMsg({ type: 'success', text: 'Successfully synced requirements and defects with Jira!' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to sync with Jira' });
    } finally {
      setSyncingJira(false);
    }
  };

  const handleConnectGitLabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gitlabUrl) return;
    try {
      const res = await connectGitLab(gitlabUrl);
      setGitlabConfig(res);
      setIsGitLabModalOpen(false);
      setFeedbackMsg({ type: 'success', text: 'GitLab instance connected successfully!' });
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to connect GitLab' });
    }
  };

  const handleDisconnectGitLab = async () => {
    try {
      const res = await disconnectGitLab();
      setGitlabConfig(res);
      setFeedbackMsg({ type: 'success', text: 'GitLab disconnected.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to disconnect GitLab' });
    }
  };

  const handleCreateWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookName) return;
    try {
      const created = await createWebhook({ name: webhookName, event: webhookEvent });
      setWebhooks([created, ...webhooks]);
      setIsWebhookModalOpen(false);
      setWebhookName('');
      setFeedbackMsg({ type: 'success', text: `Created webhook "${created.name}"` });
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to create webhook' });
    }
  };

  const handleToggleWebhook = async (id: string) => {
    try {
      const updated = await toggleWebhook(id);
      setWebhooks(webhooks.map((w) => (w.id === id ? updated : w)));
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to toggle webhook state' });
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
      setFeedbackMsg({ type: 'success', text: 'Webhook deleted' });
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to delete webhook' });
    }
  };

  const handleRoleChange = async (id: string, newRole: UserRecord['role']) => {
    try {
      const updated = await updateUserRole(id, newRole);
      setUsers(users.map((u) => (u.id === id ? updated : u)));
      setFeedbackMsg({ type: 'success', text: `Role updated to ${newRole}` });
      const logs = await fetchAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to update user role' });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FF] p-6 lg:p-8 flex flex-col gap-6">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C3C6D7]/60 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#191C20] tracking-tight">Admin Settings</h1>
          <p className="text-sm text-[#434655] mt-1">
            Manage system integrations, user permissions, and security audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncJira}
            disabled={syncingJira}
            className="border border-[#004AC6] text-[#004AC6] bg-white hover:bg-[#EEF4FF] active:bg-[#D9E3F4] rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[18px] ${syncingJira ? 'animate-spin' : ''}`}>
              sync
            </span>
            {syncingJira ? 'Syncing Jira…' : 'Sync with Jira'}
          </button>
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-[#7CF994]/20 border-[#007230]/30 text-[#007230]'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2.5 font-medium text-sm">
            <span className="material-symbols-outlined text-[20px]">
              {feedbackMsg.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-8 border-b border-[#C3C6D7]/80">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'integrations'
              ? 'text-[#004AC6] border-b-2 border-[#004AC6]'
              : 'text-[#434655] hover:text-[#004AC6]'
          }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'users'
              ? 'text-[#004AC6] border-b-2 border-[#004AC6]'
              : 'text-[#434655] hover:text-[#004AC6]'
          }`}
        >
          Users & Roles
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-semibold transition-all relative cursor-pointer ${
            activeTab === 'audit'
              ? 'text-[#004AC6] border-b-2 border-[#004AC6]'
              : 'text-[#434655] hover:text-[#004AC6]'
          }`}
        >
          Audit Log
        </button>
      </div>

      {/* TAB 1: INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div className="flex flex-col gap-8">
          {/* Integration Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Jira Integration Card */}
            <div className="bg-white border border-[#C3C6D7] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0052CC]/10 flex items-center justify-center text-[#0052CC]">
                      <span className="material-symbols-outlined text-[24px]">integration_instructions</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#191C20]">Atlassian Jira</h3>
                      <p className="text-xs text-[#434655]">Official Jira Cloud & Server Connector</p>
                    </div>
                  </div>

                  {jiraStatus.connected ? (
                    <span className="bg-[#7CF994] text-[#007230] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      CONNECTED
                    </span>
                  ) : (
                    <span className="bg-[#FEE2E2] text-[#991B1B] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      DISCONNECTED
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#434655] leading-relaxed">
                  Sync requirements, user stories, and defects directly with Jira Cloud or Server.
                </p>

                <div className="bg-[#F8F9FF] border border-[#C3C6D7]/50 rounded-lg p-3 flex flex-col gap-1.5 text-xs text-[#434655]">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Instance URL:</span>
                    <span className="font-mono text-[#191C20]">{jiraStatus.siteName || 'https://qatrack-demo.atlassian.net'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Last Sync:</span>
                    <span className="text-[#191C20]">
                      {jiraStatus.lastSyncedAt
                        ? new Date(jiraStatus.lastSyncedAt).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => setIsJiraModalOpen(true)}
                  className="border border-[#C3C6D7] text-[#334155] hover:bg-gray-50 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Configure
                </button>
                {jiraStatus.connected ? (
                  <button
                    onClick={() => setIsJiraModalOpen(true)}
                    className="border border-[#DC2626] text-[#DC2626] hover:bg-red-50 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => setIsJiraModalOpen(true)}
                    className="bg-[#004AC6] text-white hover:bg-[#003896] rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Connect Jira
                  </button>
                )}
              </div>
            </div>

            {/* GitLab CI/CD Integration Card */}
            <div className="bg-white border border-[#C3C6D7] rounded-xl p-6 shadow-sm flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                      <span className="material-symbols-outlined text-[24px]">build</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#191C20]">GitLab CI/CD</h3>
                      <p className="text-xs text-[#434655]">CI/CD Pipeline Automation</p>
                    </div>
                  </div>

                  {gitlabConfig.connected ? (
                    <span className="bg-[#7CF994] text-[#007230] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      CONNECTED
                    </span>
                  ) : (
                    <span className="bg-[#D9E3F4] text-[#434655] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      PENDING SETUP
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#434655] leading-relaxed">
                  Connect your GitLab instance to automatically trigger test suites on merge requests.
                </p>

                <div className="bg-[#F8F9FF] border border-[#C3C6D7]/50 rounded-lg p-3 flex flex-col gap-1.5 text-xs text-[#434655]">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Instance URL:</span>
                    <span className="font-mono text-[#191C20]">{gitlabConfig.instanceUrl || 'Not configured'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-500">Status:</span>
                    <span className="text-[#191C20]">{gitlabConfig.connected ? 'Active Pipeline Hook' : 'Unlinked'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                {gitlabConfig.connected ? (
                  <button
                    onClick={handleDisconnectGitLab}
                    className="border border-[#DC2626] text-[#DC2626] hover:bg-red-50 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Disconnect GitLab
                  </button>
                ) : (
                  <button
                    onClick={() => setIsGitLabModalOpen(true)}
                    className="bg-[#004AC6] text-white hover:bg-[#003896] rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Connect GitLab
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Incoming Webhooks Section */}
          <div className="bg-white border border-[#C3C6D7] rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[#C3C6D7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#191C20]">Incoming Webhooks</h3>
                <p className="text-xs text-[#434655] mt-0.5">
                  Trigger test executions from external CI/CD systems.
                </p>
              </div>

              <button
                onClick={() => setIsWebhookModalOpen(true)}
                className="border border-[#004AC6] text-[#004AC6] hover:bg-[#EEF4FF] rounded-lg px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Create New Webhook
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#EEF4FF] border-b border-[#C3C6D7] text-[11px] font-bold uppercase tracking-wider text-[#434655]">
                    <th className="py-3 px-6">NAME</th>
                    <th className="py-3 px-6">EVENT</th>
                    <th className="py-3 px-6">ENDPOINT</th>
                    <th className="py-3 px-6">STATUS</th>
                    <th className="py-3 px-6 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs text-[#191C20]">
                  {webhooks.map((wh) => (
                    <tr key={wh.id} className="hover:bg-[#F8F9FF] transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-[#191C20]">{wh.name}</td>
                      <td className="py-3.5 px-6">
                        <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded text-[11px]">
                          {wh.event}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-600 max-w-[260px] truncate" title={wh.endpoint}>
                            {wh.endpoint}
                          </span>
                          <button
                            onClick={() => copyToClipboard(wh.endpoint, wh.id)}
                            className="text-gray-400 hover:text-[#004AC6] p-1 cursor-pointer transition-colors"
                            title="Copy Endpoint"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {copiedId === wh.id ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <button
                          onClick={() => handleToggleWebhook(wh.id)}
                          className="flex items-center gap-1.5 cursor-pointer group"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              wh.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                          />
                          <span
                            className={`font-semibold capitalize text-xs ${
                              wh.status === 'active' ? 'text-emerald-700' : 'text-gray-400'
                            }`}
                          >
                            {wh.status}
                          </span>
                        </button>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Webhook"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {webhooks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No webhooks created yet. Click "+ Create New Webhook" to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="bg-white border border-[#C3C6D7] rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#C3C6D7]">
            <h3 className="text-base font-bold text-[#191C20]">User Management</h3>
            <p className="text-xs text-[#434655] mt-0.5">
              Control member permissions and access roles across the QA platform.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EEF4FF] border-b border-[#C3C6D7] text-[11px] font-bold uppercase tracking-wider text-[#434655]">
                  <th className="py-3 px-6">NAME</th>
                  <th className="py-3 px-6">EMAIL</th>
                  <th className="py-3 px-6">ROLE</th>
                  <th className="py-3 px-6">STATUS</th>
                  <th className="py-3 px-6 text-right">CHANGE ROLE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-[#191C20]">
                {users.map((usr) => (
                  <tr key={usr.id} className="hover:bg-[#F8F9FF] transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-[#191C20]">{usr.name}</td>
                    <td className="py-3.5 px-6 text-gray-600 font-mono">{usr.email}</td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          usr.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : usr.role === 'QA_LEAD'
                            ? 'bg-blue-100 text-blue-700'
                            : usr.role === 'TESTER'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {usr.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-medium text-emerald-700">{usr.status}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <select
                        value={usr.role}
                        onChange={(e) => handleRoleChange(usr.id, e.target.value as UserRecord['role'])}
                        className="border border-[#C3C6D7] rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#004AC6] cursor-pointer"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="QA_LEAD">QA LEAD</option>
                        <option value="TESTER">TESTER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-[#C3C6D7] rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#C3C6D7]">
            <h3 className="text-base font-bold text-[#191C20]">Security Audit Logs</h3>
            <p className="text-xs text-[#434655] mt-0.5">
              Traceable log of system changes, authentication events, and integration syncs.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#EEF4FF] border-b border-[#C3C6D7] text-[11px] font-bold uppercase tracking-wider text-[#434655]">
                  <th className="py-3 px-6">TIMESTAMP</th>
                  <th className="py-3 px-6">USER</th>
                  <th className="py-3 px-6">ACTION</th>
                  <th className="py-3 px-6">DETAILS</th>
                  <th className="py-3 px-6 text-right">IP ADDRESS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-[#191C20]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8F9FF] transition-colors">
                    <td className="py-3.5 px-6 text-gray-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-[#191C20]">{log.user}</td>
                    <td className="py-3.5 px-6">
                      <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded text-[11px] font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-gray-700">{log.details}</td>
                    <td className="py-3.5 px-6 text-right font-mono text-gray-500">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Connect Jira Modal */}
      <ConnectJiraModal
        isOpen={isJiraModalOpen}
        onClose={() => setIsJiraModalOpen(false)}
        onSuccess={() => {
          fetchJiraStatus().then(setJiraStatus);
          setFeedbackMsg({ type: 'success', text: 'Jira connected successfully!' });
        }}
      />

      {/* Connect GitLab Modal */}
      {isGitLabModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                  <span className="material-symbols-outlined text-[24px]">build</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Connect GitLab</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Enter your GitLab server URL or cloud instance.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGitLabModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleConnectGitLabSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  GitLab Instance URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://gitlab.com"
                  value={gitlabUrl}
                  onChange={(e) => setGitlabUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#004AC6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsGitLabModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004AC6] text-white rounded-lg font-semibold text-xs hover:bg-[#003896] cursor-pointer"
                >
                  Save Integration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#004AC6] rounded-xl">
                  <span className="material-symbols-outlined text-[24px]">webhook</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Create New Webhook</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Register a CI/CD event webhook.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWebhookModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateWebhookSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Webhook Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., GitHub Actions CI"
                  value={webhookName}
                  onChange={(e) => setWebhookName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#004AC6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Trigger Event
                </label>
                <select
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#004AC6] bg-white cursor-pointer"
                >
                  <option value="pull_request.merged">pull_request.merged</option>
                  <option value="pipeline.completed">pipeline.completed</option>
                  <option value="build.success">build.success</option>
                  <option value="test_execution.finished">test_execution.finished</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004AC6] text-white rounded-lg font-semibold text-xs hover:bg-[#003896] cursor-pointer"
                >
                  Generate Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
