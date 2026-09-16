'use client';

import { useState, useEffect } from 'react';

export interface ProductWidgetConfig {
  kpiCards: boolean;
  passRateTrend: boolean;
  coverageTrend: boolean;
  qualityHighlights: boolean;
  productCoverage: boolean;
  recentExecutions: boolean;
}

export const DEFAULT_PRODUCT_WIDGETS: ProductWidgetConfig = {
  kpiCards: true,
  passRateTrend: true,
  coverageTrend: true,
  qualityHighlights: true,
  productCoverage: true,
  recentExecutions: true,
};

interface ProductEditWidgetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: ProductWidgetConfig;
  onSave: (updated: ProductWidgetConfig) => void;
}

export function ProductEditWidgetsModal({
  isOpen,
  onClose,
  widgets,
  onSave,
}: ProductEditWidgetsModalProps) {
  const [draft, setDraft] = useState<ProductWidgetConfig>(widgets);

  useEffect(() => {
    setDraft(widgets);
  }, [widgets, isOpen]);

  if (!isOpen) return null;

  const toggleWidget = (key: keyof ProductWidgetConfig) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setDraft(DEFAULT_PRODUCT_WIDGETS);
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const items: {
    key: keyof ProductWidgetConfig;
    title: string;
    description: string;
    icon: string;
    iconColor: string;
  }[] = [
    {
      key: 'kpiCards',
      title: 'Product Quality KPI Cards',
      description: 'Displays Pass Rate (94.8%), Requirement Coverage, Open Defects, and Flaky Tests summary cards.',
      icon: 'analytics',
      iconColor: 'text-primary',
    },
    {
      key: 'passRateTrend',
      title: 'Pass Rate Trend',
      description: 'Weekly bar chart tracking pass rate progress over time.',
      icon: 'bar_chart',
      iconColor: 'text-secondary',
    },
    {
      key: 'coverageTrend',
      title: 'Coverage Trend',
      description: 'Historical trend visualization of requirement test coverage.',
      icon: 'trending_up',
      iconColor: 'text-primary',
    },
    {
      key: 'qualityHighlights',
      title: 'Quality Highlights',
      description: 'Key alert callouts for critical defects, coverage gaps, and recent improvements.',
      icon: 'auto_awesome',
      iconColor: 'text-tertiary',
    },
    {
      key: 'productCoverage',
      title: 'Product Coverage Breakdown',
      description: 'Progress bars broken down by module (Authentication, Payment Gateway, Analytics, etc.).',
      icon: 'donut_large',
      iconColor: 'text-primary',
    },
    {
      key: 'recentExecutions',
      title: 'Recent Test Executions',
      description: 'Table showing latest test execution runs, status tags, test counts, and dates.',
      icon: 'history',
      iconColor: 'text-on-surface-variant',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant w-full max-w-lg overflow-hidden flex flex-col my-8 transform transition-all">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-outline-variant flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">dashboard_customize</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface leading-snug">Edit Widgets</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Customize which metrics and visualizations appear on your product quality dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Widgets List */}
        <div className="p-6 py-4 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
          {items.map((item) => {
            const isChecked = draft[item.key];

            return (
              <div
                key={item.key}
                onClick={() => toggleWidget(item.key)}
                className="flex items-center justify-between gap-4 p-3 rounded-xl border border-outline-variant hover:bg-surface-container-low/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-surface-container-low ${item.iconColor} flex items-center justify-center mt-0.5`}>
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-body-md font-semibold text-on-surface leading-none">{item.title}</p>
                    <p className="text-label-sm text-on-surface-variant mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWidget(item.key);
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isChecked ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isChecked ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-outline-variant bg-surface-container-low/30 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-body-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            Reset to Default
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-outline-variant bg-white text-on-surface rounded-lg font-semibold text-body-sm hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-primary text-white rounded-lg font-semibold text-body-sm hover:bg-primary-container shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
