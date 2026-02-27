'use client';

import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';

type CountdownTarget = Timestamp | Date | number | string | null | undefined;

/**
 * Retourne un texte lisible du temps restant jusqu'à targetDate.
 * - Si targetDate est absent/invalide => "Clôture manuelle"
 * - Si date passée => "Terminé"
 * - Sinon => "2j 4h" / "3h 12m" / "8m 02s" / "12s"
 *
 * Safe: accepte Timestamp (Firestore), Date, number (ms), string (date), null/undefined
 */
export function useCountdown(targetDate: CountdownTarget): string {
  const [timeLeft, setTimeLeft] = useState<string>('Clôture manuelle');

  useEffect(() => {
    const targetMs =
      targetDate instanceof Timestamp
        ? targetDate.toMillis()
        : targetDate instanceof Date
          ? targetDate.getTime()
          : typeof targetDate === 'number'
            ? targetDate
            : typeof targetDate === 'string'
              ? new Date(targetDate).getTime()
              : NaN;

    // Pas de date ou date invalide
    if (!Number.isFinite(targetMs)) {
      setTimeLeft('Clôture manuelle');
      return;
    }

    const tick = () => {
      const now = Date.now();
      const diff = targetMs - now;

      if (diff <= 0) {
        setTimeLeft('Terminé');
        return false; // stop interval
      }

      const sec = Math.floor(diff / 1000);
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      const secs = sec % 60;

      if (days > 0) setTimeLeft(`${days}j ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m`);
      else if (mins > 0) setTimeLeft(`${mins}m ${String(secs).padStart(2, '0')}s`);
      else setTimeLeft(`${secs}s`);

      return true;
    };

    // Update immédiat
    const ok = tick();
    if (!ok) return;

    const id = setInterval(() => {
      const cont = tick();
      if (!cont) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}