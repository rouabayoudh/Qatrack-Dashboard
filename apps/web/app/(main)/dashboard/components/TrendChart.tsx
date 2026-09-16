'use client';

interface TrendChartProps {
  title: string;
  data: number[];
  color?: 'primary' | 'secondary';
}

export function TrendChart({ title, data, color = 'secondary' }: TrendChartProps) {
  const barColor = color === 'secondary' ? 'bg-secondary' : 'bg-primary';
  const overlayColor = color === 'secondary' ? 'bg-secondary/20' : 'bg-primary/20';

  return (
    <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">{title}</h3>
      <div className="flex items-end justify-between gap-2 h-32 pt-4">
        {data.map((val, idx) => {
          const isLatest = idx === data.length - 1;
          const heightPercent = Math.min(Math.max(val, 15), 100);

          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
              <span className="text-[10px] font-bold text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                {val}%
              </span>
              <div
                className={`w-full rounded-t ${isLatest ? barColor : overlayColor} transition-all duration-300`}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
