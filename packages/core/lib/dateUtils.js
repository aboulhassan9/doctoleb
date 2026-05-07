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
