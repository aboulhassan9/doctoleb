/**
 * Shared date/time display utilities.
 * Import these instead of re-declaring timeAgo() in every page.
 */

/**
 * Returns a human-readable relative time string.
 * @param {string|Date} dateStr - ISO date string or Date object
 * @returns {string} e.g. "just now", "3m ago", "2h ago", "1d ago"
 */
export function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Returns a chat/inbox-friendly timestamp:
 *   - same calendar day  → "14:32"
 *   - earlier this year  → "Mar 5 14:32"
 *   - empty / invalid    → ""
 *
 * Use this for message bubbles, conversation rows, and any feed where
 * "time of day" suffices for today's events but a date is needed otherwise.
 *
 * @param {string|Date|null|undefined} value - ISO string or Date
 * @returns {string}
 */
export function smartTimestamp(value) {
    if (!value) return '';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    const time = parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sameDay = parsed.toDateString() === new Date().toDateString();
    if (sameDay) return time;

    const date = parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${date} ${time}`;
}

/**
 * Format a Date as `YYYY-MM-DD` for native <input type="date"> value binding.
 * @param {Date} date
 * @returns {string} e.g. "2026-05-16"
 */
export function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Quick date shortcuts for report filter value inputs.
 * Each entry provides a human-readable label and a function that returns
 * a `YYYY-MM-DD` string suitable for <input type="date">.
 */
export const RELATIVE_DATE_SHORTCUTS = Object.freeze([
  { label: 'Today',          getValue: () => toDateInputValue(new Date()) },
  { label: 'Start of week',  getValue: () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return toDateInputValue(d); } },
  { label: 'Start of month', getValue: () => { const d = new Date(); d.setDate(1); return toDateInputValue(d); } },
  { label: '30 days ago',    getValue: () => { const d = new Date(); d.setDate(d.getDate() - 30); return toDateInputValue(d); } },
  { label: 'Start of quarter', getValue: () => { const d = new Date(); d.setMonth(Math.floor(d.getMonth() / 3) * 3); d.setDate(1); return toDateInputValue(d); } },
  { label: 'Start of year',  getValue: () => `${new Date().getFullYear()}-01-01` },
]);
