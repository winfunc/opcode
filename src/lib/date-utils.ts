/**
 * Formats a Unix timestamp to a human-readable date string
 * @param timestamp - Unix timestamp in seconds
 * @param locale - Optional locale string (defaults to browser locale)
 * @param translations - Optional translations object for localized text
 * @returns Formatted date string
 *
 * @example
 * formatUnixTimestamp(1735555200) // "Dec 30, 2024"
 */
export function formatUnixTimestamp(timestamp: number, locale?: string, translations?: { yesterday?: string }): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const currentLocale = locale || navigator.language || 'en-US';

  // If it's today, show time
  if (isToday(date)) {
    return formatTime(date, currentLocale);
  }

  // If it's yesterday
  if (isYesterday(date)) {
    const yesterdayText = translations?.yesterday || 'Yesterday';
    return `${yesterdayText}, ${formatTime(date, currentLocale)}`;
  }

  // If it's within the last week, show day of week
  if (isWithinWeek(date)) {
    return `${getDayName(date, currentLocale)}, ${formatTime(date, currentLocale)}`;
  }

  // If it's this year, don't show year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(currentLocale, {
      month: "short",
      day: "numeric",
    });
  }

  // Otherwise show full date
  return date.toLocaleDateString(currentLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats an ISO timestamp string to a human-readable date
 * @param isoString - ISO timestamp string
 * @param locale - Optional locale string (defaults to browser locale)
 * @param translations - Optional translations object for localized text
 * @returns Formatted date string
 *
 * @example
 * formatISOTimestamp("2025-01-04T10:13:29.000Z") // "Jan 4, 2025"
 */
export function formatISOTimestamp(isoString: string, locale?: string, translations?: { yesterday?: string }): string {
  const date = new Date(isoString);
  return formatUnixTimestamp(Math.floor(date.getTime() / 1000), locale, translations);
}

/**
 * Truncates text to a specified length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Gets the first line of text
 * @param text - Text to process
 * @returns First line of text
 */
export function getFirstLine(text: string): string {
  const lines = text.split("\n");
  return lines[0] || "";
}

// Helper functions
/**
 * Format time in 12-hour format with AM/PM
 *
 * @param date - Date object to format
 * @param locale - Optional locale string (defaults to browser locale)
 * @returns Formatted time string (e.g., "2:30 PM")
 */
function formatTime(date: Date, locale?: string): string {
  const currentLocale = locale || navigator.language || 'en-US';
  return date.toLocaleTimeString(currentLocale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Check if a date is today
 *
 * @param date - Date to check
 * @returns True if the date is today
 */
function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Check if a date is yesterday
 *
 * @param date - Date to check
 * @returns True if the date is yesterday
 */
function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toDateString() === yesterday.toDateString();
}

/**
 * Check if a date is within the last week
 *
 * @param date - Date to check
 * @returns True if the date is within the last 7 days
 */
function isWithinWeek(date: Date): boolean {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return date > weekAgo;
}

/**
 * Get the day name for a date
 *
 * @param date - Date to get day name for
 * @param locale - Optional locale string (defaults to browser locale)
 * @returns Day name (e.g., "Monday", "Tuesday")
 */
function getDayName(date: Date, locale?: string): string {
  const currentLocale = locale || navigator.language || 'en-US';
  return date.toLocaleDateString(currentLocale, { weekday: "long" });
}

/**
 * Formats a timestamp to a relative time string (e.g., "2 hours ago", "3 days ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 *
 * @example
 * formatTimeAgo(Date.now() - 3600000) // "1 hour ago"
 * formatTimeAgo(Date.now() - 86400000) // "1 day ago"
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
  if (months > 0) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  if (weeks > 0) {
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days > 0) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (minutes > 0) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  if (seconds > 0) {
    return seconds === 1 ? "1 second ago" : `${seconds} seconds ago`;
  }

  return "just now";
}
