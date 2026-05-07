/**
 * Centralized user identity helpers.
 * Import these instead of repeating template literals across pages.
 */

/**
 * Returns the user's full display name.
 * @param {object|null} user - The auth user object
 * @param {string} [fallback='Doctor'] - Fallback if user is null
 * @returns {string}
 */
export function getUserDisplayName(user, fallback = 'Doctor') {
    if (!user?.first_name) return fallback;
    return `${user.first_name} ${user.last_name || ''}`.trim();
}

/**
 * Returns the user's initials (1-2 uppercase characters).
 * @param {object|null} user - The auth user object
 * @param {string} [fallback='?'] - Fallback if user is null
 * @returns {string}
 */
export function getUserInitials(user, fallback = '?') {
    if (!user?.first_name) return fallback;
    return `${user.first_name[0]}${(user.last_name || '')[0] || ''}`.toUpperCase();
}

/**
 * Returns a "Dr. LastName" style label.
 * @param {object|null} user
 * @param {string} [fallback='Doctor']
 * @returns {string}
 */
export function getDoctorLabel(user, fallback = 'Doctor') {
    if (!user?.first_name) return fallback;
    return `Dr. ${user.last_name || user.first_name}`;
}
