// apps/web/components/dashboard/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CurrentUser } from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavSection {
  category?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    ],
  },
  {
    category: 'Planning',
    items: [
      { label: 'Requirements', href: '/requirements', icon: 'assignment' },
      { label: 'Test Cases', href: '/test-cases', icon: 'format_list_bulleted' },
      { label: 'Test Plans', href: '/plans', icon: 'event_note' },
    ],
  },
  {
    category: 'Execution',
    items: [
      { label: 'Executions', href: '/execution', icon: 'play_circle' },
      { label: 'Defects', href: '/defects', icon: 'bug_report' },
    ],
  },
  {
    category: 'Reporting',
    items: [
      { label: 'Qualification Reports', href: '/reports', icon: 'assessment' },
    ],
  },
  {
    category: 'Administration',
    items: [
      { label: 'Settings', href: '/settings', icon: 'settings' },
    ],
  },
];

export function Sidebar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();

  return (
    <aside className="w-sidebar-width h-screen sticky top-0 left-0 bg-white border-r border-outline-variant flex flex-col py-4 px-2 z-40">
      <div className="px-4 mb-8">
        <h1 className="font-headline-md text-headline-md font-bold text-primary">QATrack</h1>
        <p className="font-body-md text-body-md text-on-surface-variant opacity-70">
          Enterprise Edition
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.category || idx} className="space-y-1">
            {section.category && (
              <h3 className="px-3 py-2 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                {section.category}
              </h3>
            )}
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? 'flex items-center gap-3 px-3 py-2 text-primary font-semibold border-r-4 border-primary bg-surface-container-low transition-colors duration-150 cursor-pointer'
                      : 'flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors duration-150 cursor-pointer'
                  }
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="font-body-md text-body-md">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto px-4 pt-4 border-t border-outline-variant">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              className="w-8 h-8 rounded-full border border-outline-variant object-cover"
              src={user.avatarUrl}
              alt={user.name}
            />
          ) : (
            <div className="w-8 h-8 rounded-full border border-outline-variant bg-primary-container text-white flex items-center justify-center text-[11px] font-bold">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AR'}
            </div>
          )}
          <div>
            <p className="text-label-md font-semibold text-on-surface">
              {user?.name || 'Alex River'}
            </p>
            <p className="text-label-sm text-on-surface-variant">
              {user?.role || 'Lead QA Engineer'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

