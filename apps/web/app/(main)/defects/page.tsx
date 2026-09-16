'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchCurrentUser,
  fetchDefects,
  updateDefectStatus,
  createDefect,
  type CurrentUser,
  type DefectRecord,
} from '@/lib/api';
import { Sidebar } from '../dashboard/components/Sidebar';

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Critical', color: '#BA1A1A', dot: '#BA1A1A' },
  HIGH:     { label: 'High',     color: '#EA580C', dot: '#EA580C' },
  MEDIUM:   { label: 'Medium',   color: '#CA8A04', dot: '#EAB308' },
  LOW:      { label: 'Low',      color: '#C3C6D7', dot: '#C3C6D7' },
} as const;

const STATUS_CONFIG = {
  OPEN:              { label: 'Open',               bg: '#FFDAD6', text: '#93000A' },
  IN_PROGRESS:       { label: 'In Progress',        bg: '#FEF08A', text: '#854D0E' },
  READY_FOR_RETEST:  { label: 'Ready for Retest',   bg: '#7CF994', text: '#007230' },
  CLOSED:            { label: 'Closed',             bg: '#D9E3F4', text: '#434655' },
} as const;

const ROWS_PER_PAGE = 10;

export default function DefectsPage() {
  const router = useRouter();

  const [user, setUser]         = useState<CurrentUser | null>(null);
  const [defects, setDefects]   = useState<DefectRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Filters
  const [statusFilter,   setStatusFilter]   = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [search,         setSearch]         = useState('');

  // Pagination
  const [page, setPage] = useState(1);

  // Selected rows
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Create Defect Modal state (Step 1 & Step 2)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalStep, setModalStep]                 = useState<1 | 2>(1);
  const [newSummary, setNewSummary]               = useState('');
  const [newDescription, setNewDescription]       = useState('');
  const [newSteps, setNewSteps]                   = useState('');
  const [newExpected, setNewExpected]             = useState('');
  const [newActual, setNewActual]                 = useState('');
  const [newSeverity, setNewSeverity]             = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newAssignee, setNewAssignee]             = useState('');
  const [newLinkedTc, setNewLinkedTc]             = useState('');
  const [creating, setCreating]                   = useState(false);

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setModalStep(1);
    setNewSummary('');
    setNewDescription('');
    setNewSteps('');
    setNewExpected('');
    setNewActual('');
    setNewSeverity('HIGH');
    setNewAssignee('');
    setNewLinkedTc('');
  };

  const loadData = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    if (!currentUser) { router.replace('/login'); return; }
    setUser(currentUser);
    try {
      const data = await fetchDefects().catch(() => []);
      setDefects(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load defects');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const assignees = useMemo(() => {
    const set = new Set<string>();
    defects.forEach((d) => d.assignee && set.add(d.assignee));
    return Array.from(set).sort();
  }, [defects]);

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (statusFilter   && d.status   !== statusFilter)   return false;
      if (severityFilter && d.severity !== severityFilter) return false;
      if (assigneeFilter && d.assignee !== assigneeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.jiraKey.toLowerCase().includes(q) && !d.summary.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [defects, statusFilter, severityFilter, assigneeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows   = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const clearFilters = () => {
    setStatusFilter('');
    setSeverityFilter('');
    setAssigneeFilter('');
    setSearch('');
    setPage(1);
  };

  // ── Create Defect Handler ──────────────────────────────────────────────────

  const handleCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSummary.trim()) return;
    setCreating(true);

    const fullDescription = [
      newSteps.trim() ? `Steps to Reproduce:\n${newSteps.trim()}` : '',
      newExpected.trim() ? `Expected Behavior:\n${newExpected.trim()}` : '',
      newActual.trim() ? `Actual Behavior:\n${newActual.trim()}` : '',
      newDescription.trim() ? `Additional Info:\n${newDescription.trim()}` : '',
    ].filter(Boolean).join('\n\n');

    try {
      const created = await createDefect({
        summary: newSummary.trim(),
        description: fullDescription || undefined,
        severity: newSeverity,
        assignee: newAssignee.trim() || user?.name || undefined,
        linkedTestCaseId: newLinkedTc.trim() || undefined,
      });

      setDefects((prev) => [created, ...prev]);
      closeCreateModal();
    } catch (err: any) {
      setError(err?.message || 'Failed to create defect');
    } finally {
      setCreating(false);
    }
  };

  // ── Status Update ─────────────────────────────────────────────────────────

  const handleStatusChange = async (jiraKey: string, status: DefectRecord['status']) => {
    // Optimistic update
    setDefects((prev) => prev.map((d) => d.jiraKey === jiraKey ? { ...d, status } : d));
    try {
      await updateDefectStatus(jiraKey, status);
    } catch (err: any) {
      console.warn('Failed to update defect status:', err?.message);
    }
  };

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === pageRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pageRows.map((d) => d.jiraKey)));
    }
  };

  // ── Severity badge helper ─────────────────────────────────────────────────

  const SeverityCell = ({ severity }: { severity: DefectRecord['severity'] }) => {
    const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.HIGH;
    return (
      <div className="relative flex items-center gap-1.5 pl-4">
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3.5 rounded-sm"
          style={{ background: cfg.dot }}
        />
        <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  };

  const StatusBadge = ({ status }: { status: DefectRecord['status'] }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase"
        style={{ background: cfg.bg, color: cfg.text }}
      >
        {cfg.label}
      </span>
    );
  };

  // ── Jira URL helper ───────────────────────────────────────────────────────

  const jiraUrl = (key: string) =>
    `https://jira.atlassian.net/browse/${key}`;

  return (
    <div className="flex h-screen bg-[#F8F9FF] text-on-surface antialiased overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top NavBar */}
        <header className="h-14 w-full sticky top-0 z-50 bg-white border-b border-outline-variant shadow-sm flex justify-between items-center px-4 gap-4 shrink-0">
          <div className="flex items-center flex-1 min-w-0">
            <div className="relative max-w-md w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737686] text-[14px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search Defects..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-4 py-1.5 bg-[#EEF4FF] rounded-lg text-[13px] text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all border-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-outline-variant mx-1" />
            <button className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">notifications</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">help_outline</span>
            </button>
          </div>
        </header>

        {/* Main */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#121C28] tracking-tight">Defects</h1>
              <p className="text-[13px] text-[#434655] mt-0.5">
                Track and manage defects discovered during test execution across your projects.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create Defect
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-error-container border border-error rounded-lg flex items-center gap-2 text-body-sm text-on-error-container">
              <span className="material-symbols-outlined text-error text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Toolbar */}
          <div className="bg-white border border-[#C3C6D7] rounded-t-lg flex items-center justify-between px-3 py-2.5 gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-[13px] text-[#121C28] border border-[#C3C6D7] rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">Status: All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="READY_FOR_RETEST">Ready for Retest</option>
                <option value="CLOSED">Closed</option>
              </select>

              {/* Severity filter */}
              <select
                value={severityFilter}
                onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
                className="text-[13px] text-[#121C28] border border-[#C3C6D7] rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">Severity: All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* Assignee filter */}
              <select
                value={assigneeFilter}
                onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
                className="text-[13px] text-[#121C28] border border-[#C3C6D7] rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="">Assignee: All</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              {(statusFilter || severityFilter || assigneeFilter || search) && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] font-semibold text-primary hover:text-primary/80 px-2 py-1.5 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Table search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#434655] text-[13px]">search</span>
              <input
                type="text"
                placeholder="Filter defects..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-8 pr-3 py-1.5 text-[13px] border border-[#C3C6D7] rounded bg-white text-[#737686] focus:outline-none focus:ring-1 focus:ring-primary w-56"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border-x border-b border-[#C3C6D7] rounded-b-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-white">
                    <th className="py-2 px-3 w-10">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[#C3C6D7] text-primary cursor-pointer"
                        checked={pageRows.length > 0 && selected.size === pageRows.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="py-2 px-3 text-[11px] font-semibold text-[#434655] uppercase tracking-wide w-28">
                      ID
                    </th>
                    <th className="py-2 px-3 text-[11px] font-semibold text-[#434655] uppercase tracking-wide max-w-[300px]">
                      Summary
                    </th>
                    <th className="py-2 px-3 text-[11px] font-semibold text-[#434655] uppercase tracking-wide w-28">
                      Severity
                    </th>
                    <th className="py-2 px-3 text-[11px] font-semibold text-[#434655] uppercase tracking-wide w-36">
                      Status
                    </th>
                    <th className="py-2 px-3 text-[11px] font-semibold text-[#434655] uppercase tracking-wide w-32">
                      Assignee
                    </th>
                    <th className="py-2 px-3 text-[11px] font-semibold text-[#434655] uppercase tracking-wide w-32">
                      Linked TC
                    </th>
                    <th className="py-2 px-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#C3C6D7]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-[#434655] text-sm">
                        <span className="material-symbols-outlined animate-spin text-primary text-3xl block mb-2">progress_activity</span>
                        Loading defects…
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <span className="material-symbols-outlined text-4xl text-outline mb-3 block">bug_report</span>
                        <p className="text-sm font-semibold text-on-surface">No defects found</p>
                        <p className="text-xs text-on-surface-variant mt-1 mb-4">
                          {defects.length === 0
                            ? 'Click "Create Defect" or log bug tickets during test execution to record defects.'
                            : 'Try adjusting your filters.'}
                        </p>
                        <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          Create Defect
                        </button>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((defect, idx) => {
                      const isClosed   = defect.status === 'CLOSED';
                      const isSelected = selected.has(defect.jiraKey);
                      const initials = (defect.assignee || 'QA')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <tr
                          key={`defect-${defect.jiraKey}-${idx}`}
                          className={`group hover:bg-[#F8F9FF] transition-colors ${isClosed ? 'opacity-60' : ''}`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-[#C3C6D7] text-primary cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleSelect(defect.jiraKey)}
                            />
                          </td>

                          {/* ID */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`font-medium text-[13px] ${isClosed ? 'line-through text-[#C3C6D7]' : 'text-[#004AC6]'}`}
                            >
                              {defect.jiraKey}
                            </span>
                          </td>

                          {/* Summary */}
                          <td className="py-2.5 px-3 max-w-[300px]">
                            <span
                              className={`text-[13px] block truncate ${isClosed ? 'text-[#C3C6D7]' : 'text-[#121C28]'}`}
                              title={defect.summary}
                            >
                              {defect.summary}
                            </span>
                          </td>

                          {/* Severity */}
                          <td className="py-2.5 px-3">
                            <SeverityCell severity={defect.severity} />
                          </td>

                          {/* Status — dropdown to update */}
                          <td className="py-2.5 px-3">
                            {isClosed ? (
                              <StatusBadge status={defect.status} />
                            ) : (
                              <select
                                value={defect.status}
                                onChange={(e) => handleStatusChange(defect.jiraKey, e.target.value as DefectRecord['status'])}
                                className="text-[11px] font-medium border-none bg-transparent cursor-pointer focus:outline-none focus:ring-0 p-0 font-semibold"
                                style={{ color: STATUS_CONFIG[defect.status]?.text || '#121C28' }}
                              >
                                <option value="OPEN">Open</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="READY_FOR_RETEST">Ready for Retest</option>
                                <option value="CLOSED">Closed</option>
                              </select>
                            )}
                          </td>

                          {/* Assignee */}
                          <td className="py-2.5 px-3">
                            {defect.assignee ? (
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                  {initials}
                                </div>
                                <span className={`text-[13px] ${isClosed ? 'text-[#C3C6D7]' : 'text-[#121C28]'}`}>
                                  {defect.assignee}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[12px] italic text-[#C3C6D7]">—</span>
                            )}
                          </td>

                          {/* Linked TC */}
                          <td className="py-2.5 px-3">
                            {(() => {
                              const tcId = defect.linkedTestCaseId || defect.summary.match(/TC-\d+/)?.[0];
                              if (!tcId) return <span className="text-[12px] italic text-[#C3C6D7]">—</span>;
                              return (
                                <button
                                  onClick={() => router.push('/test-cases')}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 border border-[#C3C6D7] rounded text-[11px] font-semibold text-[#004AC6] hover:bg-[#EEF4FF] hover:border-primary transition-all cursor-pointer"
                                  title="View Test Cases"
                                >
                                  <span className="material-symbols-outlined text-[12px]">format_list_bulleted</span>
                                  {tcId}
                                </button>
                              );
                            })()}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                              title="More actions"
                            >
                              <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-3 py-3 border-t border-[#C3C6D7] bg-white">
              <span className="text-[13px] text-[#434655]">
                Showing {filtered.length === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, filtered.length)} of {filtered.length} defects
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center border border-[#C3C6D7] rounded text-[#434655] disabled:opacity-40 hover:bg-[#EEF4FF] transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center border rounded text-[13px] transition-colors cursor-pointer ${
                        p === page
                          ? 'bg-[#2563EB] border-[#2563EB] text-white font-semibold'
                          : 'border-[#C3C6D7] text-[#434655] hover:bg-[#EEF4FF]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    <span className="text-[#434655] text-[13px]">…</span>
                    <button
                      onClick={() => setPage(totalPages)}
                      className={`w-8 h-8 flex items-center justify-center border rounded text-[13px] transition-colors cursor-pointer ${
                        totalPages === page
                          ? 'bg-[#2563EB] border-[#2563EB] text-white font-semibold'
                          : 'border-[#C3C6D7] text-[#434655] hover:bg-[#EEF4FF]'
                      }`}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center border border-[#C3C6D7] rounded text-[#434655] disabled:opacity-40 hover:bg-[#EEF4FF] transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Create Defect Modal (2-Step Wizard) ────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          {/* Step 1 Modal Card (Compact 500px) */}
          {modalStep === 1 && (
            <div className="bg-white rounded-[12px] shadow-[0px_20px_25px_-5px_rgba(15,23,42,0.15),0px_8px_10px_-6px_rgba(15,23,42,0.1)] w-[500px] max-w-[500px] border border-[#C3C6D7]/80 flex flex-col max-h-[85vh] overflow-hidden transition-all my-auto">
              <div className="bg-white border-b border-[#C3C6D7]/80 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-[#EEF4FF] text-[#004AC6] rounded-full uppercase tracking-wider">
                    Step 1 of 2
                  </span>
                  <h3 className="text-[20px] font-bold text-[#121C28] tracking-tight">New Defect</h3>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#737686] hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newSummary.trim()) setModalStep(2);
                }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-6 min-h-0">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#121C28] tracking-wide mb-1.5 font-sans">
                      Title <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newSummary}
                      onChange={(e) => setNewSummary(e.target.value)}
                      placeholder="Describe the defect in your own words"
                      className="w-full h-[44px] px-3.5 bg-white border border-[#004AC6] shadow-[0px_0px_0px_2px_rgba(0,74,198,0.25)] rounded-[8px] text-[14px] text-[#121C28] placeholder:text-[#737686]/70 focus:outline-none transition-all font-sans"
                    />
                    <p className="text-[12px] text-[#737686] mt-2">Required for creation</p>
                  </div>
                </div>

                <div className="bg-[#EEF4FF]/70 border-t border-[#C3C6D7]/70 px-6 py-4 flex items-center justify-end gap-3 shrink-0 rounded-b-[12px]">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="h-[34px] px-4 bg-white border border-[#C3C6D7] rounded-[8px] text-[12px] font-medium text-[#434655] hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newSummary.trim()}
                    className="h-[32px] px-5 bg-[#004AC6] text-white rounded-[8px] text-[12px] font-semibold shadow-[0px_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#003ea8] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span>Continue</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2 Modal Card (Large 1095px Figma Spec) */}
          {modalStep === 2 && (
            <div className="bg-[#F8F9FF] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] w-[1095px] max-w-[1152px] h-[90vh] max-h-[1024px] border border-[#C3C6D7] flex flex-col overflow-hidden transition-all my-auto relative">
              {/* Header Bar */}
              <div className="p-6 pb-4 bg-[#F8F9FF] flex flex-col gap-3 shrink-0 border-b border-[#C3C6D7]/60">
                {/* Back Link */}
                <button
                  type="button"
                  onClick={() => setModalStep(1)}
                  className="flex items-center gap-1 text-[#004AC6] text-[14px] font-medium hover:underline cursor-pointer w-fit"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Back to Step 1
                </button>

                {/* Title Row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <h2 className="text-[24px] font-semibold text-[#121C28] tracking-tight shrink-0">Defect</h2>
                    <div className="bg-[#E5EEFF] border border-[#C3C6D7] rounded-[8px] px-3 py-1 text-[15px] italic text-[#434655] truncate max-w-xl">
                      "{newSummary}"
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#737686] hover:bg-gray-200/60 transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Metadata Top Banner */}
                <div className="bg-[#EEF4FF] border border-[#C3C6D7] rounded-[8px] px-6 py-3 flex items-center justify-between text-xs mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[#737686] uppercase tracking-wider">STATUS</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase bg-[#FFDAD6] text-[#93000A]">OPEN</span>
                  </div>
                  <div className="h-6 w-px bg-[#C3C6D7]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[#737686] uppercase tracking-wider">REPORTER</span>
                    <span className="font-medium text-[#121C28]">{user?.name || 'QA Engineer'}</span>
                  </div>
                  <div className="h-6 w-px bg-[#C3C6D7]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[#737686] uppercase tracking-wider">CREATED</span>
                    <span className="font-medium text-[#121C28]">Today</span>
                  </div>
                  <div className="h-6 w-px bg-[#C3C6D7]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[#737686] uppercase tracking-wider">PROJECT</span>
                    <span className="font-medium text-[#121C28]">QAT</span>
                  </div>
                  <div className="h-6 w-px bg-[#C3C6D7]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-[#737686] uppercase tracking-wider">SEVERITY</span>
                    <span className="font-bold text-[#006E2D] uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#006E2D]" />
                      {newSeverity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleCreateDefect} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 custom-scrollbar">
                  {/* Section 1: Steps to Reproduce */}
                  <div className="bg-white border border-[#C3C6D7] shadow-sm rounded-[12px] p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#004AC6] text-[20px]">list_alt</span>
                        <h3 className="text-[16px] font-semibold text-[#121C28]">Steps to Reproduce</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewSteps((prev) => prev ? prev : "1. Navigate to page\n2. Trigger action\n3. Observe error")}
                        className="px-3 py-1 border border-[#C3C6D7] rounded-full text-[11px] font-bold text-[#2563EB] hover:bg-[#EEF4FF] transition-all cursor-pointer"
                      >
                        Auto-Format
                      </button>
                    </div>
                    <div className="relative">
                      <textarea
                        rows={4}
                        value={newSteps}
                        onChange={(e) => setNewSteps(e.target.value)}
                        placeholder="1. Navigate to checkout... 2. Click finalize payment..."
                        className="w-full p-3.5 bg-white border border-[#C3C6D7] rounded-[8px] text-[14px] text-[#121C28] placeholder:text-[#6B7280] focus:outline-none focus:border-[#004AC6] focus:ring-1 focus:ring-[#004AC6] transition-all font-sans"
                      />
                      <span className="absolute bottom-2.5 right-3 text-[10px] text-[#737686]">
                        {newSteps.length} characters
                      </span>
                    </div>
                  </div>

                  {/* Section 2: Expected vs Actual Behavior */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Expected Behavior */}
                    <div className="bg-white border border-[#C3C6D7] shadow-sm rounded-[12px] p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#006E2D] text-[20px]">check_circle</span>
                          <h3 className="text-[16px] font-semibold text-[#121C28]">Expected Behavior</h3>
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={newExpected}
                        onChange={(e) => setNewExpected(e.target.value)}
                        placeholder="The payment should process and redirect to success page..."
                        className="w-full p-3.5 bg-white border border-[#C3C6D7] rounded-[8px] text-[14px] text-[#121C28] placeholder:text-[#6B7280] focus:outline-none focus:border-[#004AC6] focus:ring-1 focus:ring-[#004AC6] transition-all font-sans"
                      />
                    </div>

                    {/* Actual Behavior */}
                    <div className="bg-white border border-[#C3C6D7] shadow-sm rounded-[12px] p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#BA1A1A] text-[20px]">error</span>
                          <h3 className="text-[16px] font-semibold text-[#121C28]">Actual Behavior</h3>
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={newActual}
                        onChange={(e) => setNewActual(e.target.value)}
                        placeholder="System hangs on 'Processing' for 120s then throws 504..."
                        className="w-full p-3.5 bg-white border border-[#C3C6D7] rounded-[8px] text-[14px] text-[#121C28] placeholder:text-[#6B7280] focus:outline-none focus:border-[#004AC6] focus:ring-1 focus:ring-[#004AC6] transition-all font-sans"
                      />
                    </div>
                  </div>

                  {/* Section 3: Priority, Linked TC, Assignee */}
                  <div className="bg-white border border-[#C3C6D7] shadow-sm rounded-[12px] p-6 grid grid-cols-3 gap-6">
                    <div>
                      <label className="block text-[14px] font-medium text-[#121C28] mb-1.5">
                        Severity / Priority
                      </label>
                      <select
                        value={newSeverity}
                        onChange={(e) => setNewSeverity(e.target.value as any)}
                        className="w-full h-[42px] px-3.5 bg-white border border-[#C3C6D7] rounded-[8px] text-[14px] text-[#121C28] focus:outline-none focus:border-[#004AC6] transition-all cursor-pointer font-medium"
                      >
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                      <p className="text-[11px] text-[#737686] mt-1">Priority affects the JIRA triage workflow speed.</p>
                    </div>

                    <div>
                      <label className="block text-[14px] font-medium text-[#121C28] mb-1.5">
                        Linked Test Case ID
                      </label>
                      <input
                        type="text"
                        value={newLinkedTc}
                        onChange={(e) => setNewLinkedTc(e.target.value)}
                        placeholder="e.g. TC-1001"
                        className="w-full h-[42px] px-3.5 bg-white border border-[#C3C6D7] rounded-[8px] text-[14px] text-[#121C28] placeholder:text-[#6B7280] focus:outline-none focus:border-[#004AC6] transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[14px] font-medium text-[#121C28] mb-1.5">
                        Assignee
                      </label>
                      <input
                        type="text"
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        placeholder={user?.name || 'Assignee name...'}
                        className="w-full h-[42px] px-3.5 bg-white border border-[#C3C6D7] rounded-[8px] text-[14px] text-[#121C28] placeholder:text-[#6B7280] focus:outline-none focus:border-[#004AC6] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="bg-white border-t border-[#C3C6D7] px-8 py-5 flex items-center justify-end gap-3 shrink-0 rounded-b-[16px]">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="h-[42px] px-6 bg-white border border-[#C3C6D7] rounded-[8px] text-[16px] font-medium text-[#121C28] hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newSummary.trim()}
                    className="h-[42px] px-8 bg-[#004AC6] text-white rounded-[8px] text-[16px] font-semibold shadow-sm hover:bg-[#003ea8] flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {creating ? (
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    )}
                    <span>{creating ? 'Creating…' : 'Create Defect'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
