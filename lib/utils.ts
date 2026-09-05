import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse any date input (Date, string, timestamp, Firestore Timestamp) into a JavaScript Date.
 */
export function parseToDate(input: any): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  if (typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      // fallback
    }
  }
  if (input.seconds && typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }
  if (typeof input === 'string') {
    // If format is DD-MM-YYYY
    const ddMmYyyyMatch = input.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (ddMmYyyyMatch) {
      const [, day, month, year] = ddMmYyyyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Format any date into standardized DD-MM-YYYY format (e.g. 04-09-2026).
 */
export function formatDateDDMMYYYY(input: any): string {
  const d = parseToDate(input);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format date into DD-MM-YYYY HH:mm for timestamps.
 */
export function formatDateTimeDDMMYYYY(input: any): string {
  const d = parseToDate(input);
  const datePart = formatDateDDMMYYYY(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
}

/**
 * Format date into friendly day with DD-MM-YYYY (e.g. "Friday, 04-09-2026").
 */
export function formatFriendlyDateDDMMYYYY(input: any): string {
  const d = parseToDate(input);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  return `${weekday}, ${formatDateDDMMYYYY(d)}`;
}
