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
