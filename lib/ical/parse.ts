import type { IcalEvent } from "./types";

/** YYYYMMDD or YYYYMMDDTHHMMSS(Z) → YYYY-MM-DD */
export function parseICalDateToISO(dateStr: string): string {
  const raw = String(dateStr || "").trim();
  if (raw.length >= 8 && /^\d{8}/.test(raw)) {
    return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`;
  }
  return raw;
}

function unfoldIcal(text: string): string[] {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const folded = raw.split("\n");
  const lines: string[] = [];
  for (const line of folded) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function icalPropValue(line: string): string {
  const idx = line.indexOf(":");
  if (idx < 0) return "";
  return line.slice(idx + 1).trim();
}

/**
 * Мінімальний парсер VEVENT: DTSTART / DTEND / UID / SUMMARY.
 * DTEND для VALUE=DATE — виключний (день виїзду).
 */
export function parseICal(icalText: string): IcalEvent[] {
  const lines = unfoldIcal(icalText);
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current?.start && current.end && current.uid) {
        events.push({
          uid: current.uid,
          start: current.start,
          end: current.end,
          summary: current.summary,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const upper = line.toUpperCase();
    if (upper.startsWith("DTSTART")) {
      current.start = parseICalDateToISO(icalPropValue(line));
    } else if (upper.startsWith("DTEND")) {
      current.end = parseICalDateToISO(icalPropValue(line));
    } else if (upper.startsWith("UID:")) {
      current.uid = icalPropValue(line);
    } else if (upper.startsWith("SUMMARY")) {
      current.summary = icalPropValue(line);
    }
  }

  return events;
}
