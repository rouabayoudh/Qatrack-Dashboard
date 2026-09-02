'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '../../lib/api';

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Verify the session cookie is valid; redirect to /login if not.
    fetchCurrentUser().then((user) => {
      if (!user) {
        router.replace('/login');
      } else {
        setMounted(true);
      }
    });
  }, [router]);

  // Show nothing while auth is being verified to avoid a flash of unauthenticated content.
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading…
        </div>
      </div>
    );
  }


  return <>{children}</>;
}
