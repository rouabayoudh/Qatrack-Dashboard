'use client';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string | number;
  changeType?: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
}

export function KpiCard({ title, value, change, changeType = 'positive', subtitle }: KpiCardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <span className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
        {title}
      </span>

      <div className="flex items-baseline justify-between mt-2">
        <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
          {value}
        </span>

        {change !== undefined && (
          <div className="flex items-center gap-0.5">
            <span
              className={`material-symbols-outlined text-[16px] ${
                isPositive ? 'text-secondary' : isNegative ? 'text-error' : 'text-on-surface-variant'
              }`}
            >
              {isPositive ? 'trending_up' : isNegative ? 'trending_down' : 'remove'}
            </span>
            <span
              className={`text-label-sm font-bold ${
                isPositive ? 'text-secondary' : isNegative ? 'text-error' : 'text-on-surface-variant'
              }`}
            >
              {typeof change === 'number' && change > 0 ? `+${change}` : change}
              {typeof change === 'number' && '%'}
            </span>
          </div>
        )}

        {subtitle && (
          <span className="text-label-sm text-on-surface-variant font-medium">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
