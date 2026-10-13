import { useEffect, useState } from 'react';

/** 83456 -> "1:23.45" */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * `performance.now()`, refreshed on an interval while `active`. Timers compare it
 * with a start time taken from the same clock, so they never depend on the
 * player's wall clock agreeing with the server's.
 */
export function useNow(active: boolean, intervalMs = 50): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(performance.now());
    const starter = setTimeout(tick, 0);
    const interval = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(starter);
      clearInterval(interval);
    };
  }, [active, intervalMs]);

  return now;
}
