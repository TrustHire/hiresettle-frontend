/**
 * Client-side calendar helpers — no backend required.
 * Generates .ics blobs and Google Calendar URLs for retention unlock events.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  startDate: Date;
  /** Duration in minutes — defaults to 60 */
  durationMinutes?: number;
  url?: string;
}

/** Format a Date as a UTC timestamp string for iCalendar: YYYYMMDDTHHmmssZ */
function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** Naive UID — good enough for a one-off calendar invite */
function uid(title: string, date: Date): string {
  return `${date.getTime()}-${title.replace(/\s+/g, '-').toLowerCase()}@hiresettle`;
}

/**
 * Build a RFC 5545-compliant .ics string for a single all-day-ish event.
 * The event is a 1-hour block starting at 09:00 UTC on the unlock date.
 */
export function buildIcs(event: CalendarEvent): string {
  const { title, description, startDate, durationMinutes = 60, url } = event;
  const end = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HireSettle//Retention Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid(title, startDate)}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${title}`,
    // Fold long lines at 75 chars per RFC 5545 §3.1
    ...foldIcsLine(`DESCRIPTION:${description.replace(/\n/g, '\\n')}`),
    ...(url ? foldIcsLine(`URL:${url}`) : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/** RFC 5545 line folding: lines > 75 octets must be wrapped with CRLF + space */
function foldIcsLine(line: string): string[] {
  if (line.length <= 75) return [line];
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks;
}

/** Trigger a browser download of the .ics file */
export function downloadIcs(event: CalendarEvent, filename?: string): void {
  const content = buildIcs(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${event.title.replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a Google Calendar "add event" URL.
 * Dates must be in YYYYMMDDTHHmmssZ format.
 */
export function googleCalendarUrl(event: CalendarEvent): string {
  const { title, description, startDate, durationMinutes = 60, url } = event;
  const end = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d: Date) => toIcsDate(d);

  const details = url ? `${description}\n\n${url}` : description;

  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    title,
    dates:   `${fmt(startDate)}/${fmt(end)}`,
    details: details,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
