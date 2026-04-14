'use client';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

/**
 * ConditionalLayout
 *
 * Public routes (e.g. /jobs/*) get NO sidebar — just the raw page.
 * All internal routes get the standard sidebar + main-content shell.
 */
const PUBLIC_PREFIXES = ['/jobs/'];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isPublic = PUBLIC_PREFIXES.some(p => path.startsWith(p));

  if (isPublic) {
    // Completely bare — no sidebar, no layout-wrap, full viewport
    return <>{children}</>;
  }

  return (
    <div className="layout-wrap">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
