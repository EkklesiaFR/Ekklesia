
'use client';

import { useState, useEffect } from 'react';
import { firebaseConfig } from '@/firebase/config';

/**
 * A minimalist debug panel that displays environment information.
 * Only renders in development mode to assist with project verification.
 */
export function DebugPanel() {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    // Avoid hydration mismatch by setting hostname after mount
    setHostname(window.location.hostname);
  }, []);

  // Respect the "only in development" constraint
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-[9999] bg-white border border-border p-4 text-[10px] font-mono shadow-sm pointer-events-none select-none opacity-80 hover:opacity-100 transition-opacity">
      <p className="font-bold uppercase tracking-[0.2em] mb-2 border-b border-border pb-1 text-black">
        Configuration
      </p>
      <ul className="space-y-1 text-muted-foreground">
        <li>
          <span className="font-bold text-black uppercase tracking-widest">Project:</span> {firebaseConfig.projectId}
        </li>
        <li>
          <span className="font-bold text-black uppercase tracking-widest">Auth Domain:</span> {firebaseConfig.authDomain}
        </li>
        <li>
          <span className="font-bold text-black uppercase tracking-widest">Hostname:</span> {hostname || 'Chargement...'}
        </li>
      </ul>
    </div>
  );
}
