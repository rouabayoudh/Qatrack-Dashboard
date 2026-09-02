'use client';

export interface WidgetConfig {
  recentExecutions: boolean;
  coverageByComponent: boolean;
  criticalDefects: boolean;
}

export const DEFAULT_WIDGETS: WidgetConfig = {
  recentExecutions: true,
  coverageByComponent: true,
  criticalDefects: true,
};

interface EditWidgetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  widgets: WidgetConfig;
  onSave: (updated: WidgetConfig) => void;
}

const WIDGET_LABELS: { key: keyof WidgetConfig; title: string; description: string; icon: string }[] = [
  {
    key: 'recentExecutions',
    title: 'Recent Test Executions',
    description: 'Table showing the latest test runs, statuses, and duration.',
    icon: 'checklist',
  },
  {
    key: 'coverageByComponent',
    title: 'Coverage by Product',
    description: 'Breakdown of requirement verification rates grouped by product.',
    icon: 'pie_chart',
  },
  {
    key: 'criticalDefects',
    title: 'Critical Defects',
    description: 'List of active bug reports synced directly from Jira.',
    icon: 'bug_report',
  },
];

export function EditWidgetsModal({ isOpen, onClose, widgets, onSave }: EditWidgetsModalProps) {
  if (!isOpen) return null;

  const handleToggle = (key: keyof WidgetConfig) => {
    onSave({
      ...widgets,
      [key]: !widgets[key],
    });
  };

  const handleReset = () => {
    onSave(DEFAULT_WIDGETS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className="bg-white border border-outline-variant rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[24px]">widgets</span>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Customize Widgets</h3>
              <p className="text-body-sm text-on-surface-variant">Toggle widgets to show or hide on your dashboard.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3 divide-y divide-outline-variant/60">
          {WIDGET_LABELS.map((item, index) => {
            const isChecked = widgets[item.key];
            return (
              <div
                key={item.key}
                className={`flex items-start justify-between gap-4 cursor-pointer select-none rounded-lg p-2 transition-colors hover:bg-surface-container-low ${
                  index !== 0 ? 'pt-3' : ''
                }`}
                onClick={() => handleToggle(item.key)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      isChecked ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] block">{item.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-body-md text-on-surface">{item.title}</h4>
                    <p className="text-[12px] text-on-surface-variant leading-tight mt-0.5">{item.description}</p>
                  </div>
                </div>

                <div className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(item.key)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant bg-surface-container-low flex justify-between items-center">
          <button
            type="button"
            onClick={handleReset}
            className="text-body-sm text-on-surface-variant hover:text-primary font-medium transition-colors"
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold text-body-sm hover:opacity-90 active:scale-95 transition-all shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
