'use client';

import type { QualityHighlight } from '@qatrack/shared-types';

interface QualityHighlightsProps {
  highlights: QualityHighlight[];
}

export function QualityHighlights({ highlights }: QualityHighlightsProps) {
  return (
    <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">Quality Highlights</h3>
      <div className="space-y-2 flex-1 flex flex-col justify-around">
        {highlights.map((item, idx) => {
          const isGood = item.type === 'good';

          return (
            <div
              key={idx}
              className={`flex items-center gap-2.5 p-2 rounded-lg text-body-sm font-medium ${
                isGood ? 'bg-secondary-container/20 text-on-surface' : 'bg-error-container/30 text-on-error-container'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] shrink-0 ${
                  isGood ? 'text-secondary' : 'text-error'
                }`}
              >
                {isGood ? 'check_circle' : 'warning'}
              </span>
              <span className="truncate">{item.text}</span>
            </div>
          );
        })}

        {highlights.length === 0 && (
          <p className="text-body-sm text-on-surface-variant text-center py-6">
            No quality highlights recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
