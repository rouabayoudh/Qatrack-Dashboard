'use client';

import type { DailyTrend } from '@qatrack/shared-types';

function getWeekdayLabel(dateStr: string): string {
  try {
    // Use UTC noon to avoid timezone date-shift
    const date = new Date(dateStr + 'T12:00:00Z');
    return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  } catch {
    return dateStr.slice(5); // fallback: MM-DD
  }
}

export function PassFailTrend({ trend }: { trend: DailyTrend[] }) {
  const maxTotal = Math.max(...trend.map((t) => t.passCount + t.failCount), 1);

  return (
    <div className="lg:col-span-6 bg-white border border-outline-variant rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-headline-sm text-headline-sm">Pass/Fail Trend</h3>
        <div className="flex items-center gap-4 text-label-sm">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
            {' '}Pass
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-error inline-block" />
            {' '}Fail
          </div>
        </div>
      </div>

      <div className="h-48 flex items-end justify-between gap-2 px-2 relative">
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[120px]">show_chart</span>
        </div>

        {trend.map((day, i) => {
          const total = day.passCount + day.failCount;
          const heightPercent = total > 0 ? (total / maxTotal) * 100 : 4;
          const failRatio = total > 0 ? day.failCount / total : 0;
          const isMostlyFailing = failRatio > 0.3;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col justify-end h-full relative group cursor-pointer"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded text-label-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none whitespace-nowrap text-[11px]">
                Pass: {day.passCount} | Fail: {day.failCount}
              </div>

              {/* Bar — color reflects pass vs fail dominance */}
              <div
                className={`w-full rounded-t ${isMostlyFailing ? 'bg-error/25' : 'bg-secondary/25'}`}
                style={{ height: `${heightPercent}%` }}
              >
                {/* inner fill overlay for the dominant colour */}
                <div
                  className={`w-full h-full rounded-t ${isMostlyFailing ? 'bg-error/20' : 'bg-secondary/20'}`}
                />
              </div>
            </div>
          );
        })}

        {trend.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-body-sm text-on-surface-variant">
            No trend data yet.
          </p>
        )}
      </div>

      <div className="flex justify-between mt-4 text-label-sm text-on-surface-variant">
        {trend.map((day, i) => (
          <span key={i} className="text-center flex-1">
            {getWeekdayLabel(day.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
