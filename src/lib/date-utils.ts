/**
 * PolicyPilot Canonical Date & Timezone Utilities
 * 
 * All business calendar days and renewal boundaries are anchored to Indian Standard Time (Asia/Kolkata, UTC+05:30).
 * Prevents accidental date-shifting caused by server host timezones (e.g., UTC on cloud runtimes).
 */

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/** Advance a policy anniversary, clamping February 29 to February 28. */
export function addCalendarYear(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid policy expiry date');
  const [year, month, day] = date.split('-').map(Number);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (original.toISOString().slice(0, 10) !== date) throw new Error('Invalid policy expiry date');
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/**
 * Returns the current date in Asia/Kolkata formatted as YYYY-MM-DD.
 */
export function getTodayDateString(offsetDays: number = 0): string {
  const now = new Date();
  if (offsetDays !== 0) {
    now.setDate(now.getDate() + offsetDays);
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Returns current time in Asia/Kolkata formatted as HH:mm (24-hour clock).
 */
export function getCurrentTimeInIndia(): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date());
}

/**
 * Formats a Date object or ISO string to YYYY-MM-DD in Asia/Kolkata.
 */
export function formatDateInIndia(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return getTodayDateString();
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Canonical Overdue Logic for CRM Tasks & Follow-ups:
 * overdue = scheduled_datetime < current_datetime AND status NOT IN ('completed', 'cancelled')
 * 
 * Evaluated strictly in Asia/Kolkata timezone.
 */
export function checkIsOverdue(
  scheduledDate: string,
  scheduledTime?: string | null,
  status?: string | null
): boolean {
  if (!scheduledDate) return false;
  if (status === 'completed' || status === 'cancelled') return false;

  const todayStr = getTodayDateString();

  // If scheduled for an earlier calendar day, it is overdue
  if (scheduledDate < todayStr) return true;

  // If scheduled for today, check whether the scheduled time has already passed
  if (scheduledDate === todayStr && scheduledTime) {
    const currentTimeStr = getCurrentTimeInIndia();
    const cleanSchedTime = scheduledTime.trim().slice(0, 5); // Extract 'HH:mm'
    if (cleanSchedTime.length === 5 && cleanSchedTime < currentTimeStr) {
      return true;
    }
  }

  return false;
}
