export interface Remaining {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  isExpired: boolean;
}

function breakdown(ms: number): Remaining {
  const totalSec = Math.max(Math.floor(ms / 1000), 0);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return { days, hours, mins, secs, isExpired: ms <= 0 };
}

export { breakdown };
