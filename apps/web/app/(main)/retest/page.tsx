'use client';

import { useEffect, useState } from 'react';
import {
  fetchRetestCycles,
  createRetestCycle,
  triggerRetestCycle,
  type RetestCycle,
} from '@/lib/api';

export default function RetestRegressionPage() {
  const [cycles, setCycles] = useState<RetestCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'REGRESSION' | 'RETEST'>('ALL');
  
  // Modals & Toasts
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCycleName, setNewCycleName] = useState('');
  const [newCycleType, setNewCycleType] = useState<'REGRESSION' | 'RETEST'>('REGRESSION');
  const [newTotalCases, setNewTotalCases] = useState(150);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadCycles = async () => {
    setLoading(true);
    try {
      const data = await fetchRetestCycles();
      setCycles(data);
    } catch (err) {
      console.error('Failed loading retest cycles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCycleName.trim()) return;

    try {
      const created = await createRetestCycle({
        name: newCycleName,
        type: newCycleType,
        totalCases: Number(newTotalCases),
      });
      setCycles([created, ...cycles]);
      setIsCreateModalOpen(false);
      setNewCycleName('');
      triggerToast(`Retest cycle "${created.name}" created successfully!`);
    } catch (err: any) {
      triggerToast(err.message || 'Failed to create retest cycle');
    }
  };

  const handleRunCycle = async (id: string, name: string) => {
    try {
      const updated = await triggerRetestCycle(id);
      setCycles(cycles.map((c) => (c.id === id ? updated : c)));
      triggerToast(`Execution triggered for "${name}" (${updated.progress}% completed)`);
    } catch (err: any) {
      triggerToast('Failed to trigger retest execution');
    }
  };

  const filteredCycles = cycles.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.owner.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FF] p-6 lg:p-8 flex flex-col gap-6 relative">
      {/* Top Header Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#C3C6D7]/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#737686] mb-1">
            <span>Execution</span>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-[#121C28]">Retest & Regression</span>
          </div>
          <h1 className="text-2xl font-bold text-[#121C28] tracking-tight">
            Retest & Regression Cycles
          </h1>
          <p className="text-xs text-[#434655] mt-1">
            Manage automated and manual regression sweeps, retest failing test cases, and track cycle stability.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#004AC6] hover:bg-[#003896] text-white font-bold rounded-lg px-5 py-2.5 text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          + New Retest Cycle
        </button>
      </div>

      {/* Summary Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Cycles */}
        <div className="bg-white border border-[#C3C6D7] rounded-xl p-4 shadow-sm flex flex-col justify-between h-[128px]">
          <div className="flex items-center justify-between text-xs font-bold text-[#737686]">
            <span>Active Cycles</span>
            <span className="material-symbols-outlined text-[#004AC6] text-[20px]">autorenew</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#121C28]">{cycles.length}</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#006E2D] mt-1">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              <span>+2 active this week</span>
            </div>
          </div>
        </div>

        {/* Card 2: Regression Pass Rate */}
        <div className="bg-white border border-[#C3C6D7] rounded-xl p-4 shadow-sm flex flex-col justify-between h-[128px]">
          <div className="flex items-center justify-between text-xs font-bold text-[#737686]">
            <span>Regression Pass Rate</span>
            <span className="material-symbols-outlined text-[#006E2D] text-[20px]">check_circle</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#121C28]">84.2%</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#006E2D] mt-1">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              <span>+3.4% vs last run</span>
            </div>
          </div>
        </div>

        {/* Card 3: Flaky Tests */}
        <div className="bg-white border border-[#C3C6D7] rounded-xl p-4 shadow-sm flex flex-col justify-between h-[128px]">
          <div className="flex items-center justify-between text-xs font-bold text-[#737686]">
            <span>Flaky Tests</span>
            <span className="material-symbols-outlined text-[#BA1A1A] text-[20px]">warning</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#121C28]">27</div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-[#BA1A1A] mt-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              <span>+5 needs review</span>
            </div>
          </div>
        </div>

        {/* Card 4: Next Scheduled */}
        <div className="bg-white border border-[#C3C6D7] rounded-xl p-4 shadow-sm flex flex-col justify-between h-[128px] relative overflow-hidden">
          <div className="absolute -right-3 -bottom-3 opacity-10 text-[#004AC6]">
            <span className="material-symbols-outlined text-[72px]">schedule</span>
          </div>
          <div className="flex items-center justify-between text-xs font-bold text-[#737686]">
            <span>Next Scheduled</span>
            <span className="material-symbols-outlined text-[#6A1EDB] text-[20px]">schedule</span>
          </div>
          <div className="z-10">
            <div className="text-base font-bold text-[#121C28] truncate">Nightly Regression</div>
            <div className="text-[11px] italic font-semibold text-[#737686] mt-1">Starts in 4h 12m</div>
          </div>
        </div>
      </div>

      {/* Retest Cycles Table Card */}
      <div className="bg-white border border-[#C3C6D7] rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Header Controls */}
        <div className="bg-[#EEF4FF] border-b border-[#C3C6D7] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[#121C28]">Retest & Regression Cycles</h3>
            <span className="bg-white border border-[#C3C6D7] rounded px-2.5 py-0.5 text-xs font-semibold text-[#121C28] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#006E2D]" />
              Active: {cycles.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#737686] text-[16px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search retest cycles, bugs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#C3C6D7] rounded-lg text-xs focus:outline-none focus:border-[#004AC6]"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-white border border-[#C3C6D7] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#121C28] focus:outline-none focus:border-[#004AC6] cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="REGRESSION">REGRESSION</option>
              <option value="RETEST">RETEST</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FF] border-b border-[#C3C6D7] text-[11px] font-bold uppercase tracking-wider text-[#737686]">
                <th className="py-3.5 px-6">CYCLE NAME</th>
                <th className="py-3.5 px-4">TYPE</th>
                <th className="py-3.5 px-4">PROGRESS</th>
                <th className="py-3.5 px-4">HEALTH</th>
                <th className="py-3.5 px-4">PASS / FAIL</th>
                <th className="py-3.5 px-6">OWNER / STARTED</th>
                <th className="py-3.5 px-6 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-[#121C28]">
              {filteredCycles.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8F9FF] transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-[#121C28] text-sm">{c.name}</div>
                    <div className="text-[11px] font-semibold text-[#737686] mt-0.5">
                      {c.id} • {c.totalCases} Cases
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.type === 'REGRESSION'
                          ? 'bg-[#004AC6]/10 border border-[#004AC6]/20 text-[#004AC6]'
                          : 'bg-[#7CF994] border border-[#007230]/20 text-[#007230]'
                      }`}
                    >
                      {c.type}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#006E2D] h-full transition-all duration-300"
                          style={{ width: `${c.progress}%` }}
                        />
                      </div>
                      <span className="font-bold text-xs text-[#121C28]">{c.progress}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-r border-l-4 font-bold text-[10px] uppercase ${
                        c.health === 'CRITICAL'
                          ? 'bg-[#FFDAD6] border-[#BA1A1A] text-[#93000A]'
                          : c.health === 'HEALTHY'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                          : 'bg-[#E5EEFF] border-[#737686] text-[#434655]'
                      }`}
                    >
                      {c.health.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-semibold">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#006E2D] flex items-center gap-0.5 font-bold">
                        <span className="material-symbols-outlined text-[14px]">check</span>
                        {c.passedCases}
                      </span>
                      <span className="text-[#BA1A1A] flex items-center gap-0.5 font-bold">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                        {c.failedCases}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-semibold text-[#121C28]">{c.owner}</div>
                    <div className="text-[11px] text-[#737686]">{c.startedAt}</div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleRunCycle(c.id, c.name)}
                      className="border border-[#004AC6] text-[#004AC6] hover:bg-[#EEF4FF] rounded-lg px-3 py-1.5 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Run Retest
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCycles.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No retest cycles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-4 border-t border-[#C3C6D7] bg-white flex items-center justify-between text-xs text-[#434655]">
          <div>Showing 1 - {filteredCycles.length} of {cycles.length} cycles</div>
          <div className="flex items-center gap-2">
            <button className="border border-[#C3C6D7] px-2.5 py-1 rounded text-gray-400 cursor-not-allowed">
              Previous
            </button>
            <button className="bg-[#004AC6] text-white px-2.5 py-1 rounded font-semibold cursor-pointer">
              1
            </button>
            <button className="border border-[#C3C6D7] px-2.5 py-1 rounded text-[#121C28] hover:bg-gray-50 cursor-pointer">
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#27313E] text-[#EAF1FF] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-fade-in text-xs font-medium">
          <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-gray-400 hover:text-white ml-2">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Create Retest Cycle Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-6 pb-4 border-b border-gray-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#004AC6] rounded-xl">
                  <span className="material-symbols-outlined text-[24px]">autorenew</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">New Retest Cycle</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Configure regression or defect retest sweep.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cycle Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sprint 24 Regression Sweep"
                  value={newCycleName}
                  onChange={(e) => setNewCycleName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#004AC6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cycle Type</label>
                <select
                  value={newCycleType}
                  onChange={(e) => setNewCycleType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#004AC6] bg-white cursor-pointer"
                >
                  <option value="REGRESSION">REGRESSION</option>
                  <option value="RETEST">RETEST</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Total Test Cases</label>
                <input
                  type="number"
                  value={newTotalCases}
                  onChange={(e) => setNewTotalCases(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:border-[#004AC6]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg font-semibold text-xs hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#004AC6] text-white rounded-lg font-semibold text-xs hover:bg-[#003896] cursor-pointer shadow-sm"
                >
                  Create Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
