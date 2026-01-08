// date.ts: Shared date formatting helpers for user-facing UI.

// Format an ISO date string as "Jan 6, 2026" for display.
export function formatDateLong(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
}
