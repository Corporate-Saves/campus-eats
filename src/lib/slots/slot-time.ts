import { format, parse } from "date-fns";

/** Normalize UI or DB time to `HH:MM:SS` for Postgres `time`. */
export function normalizeTimeToHms(input: string): string {
  const trimmed = input.trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!m) {
    throw new Error("Invalid time format");
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] != null ? Number(m[3]) : 0;
  if (
    Number.isNaN(h) ||
    Number.isNaN(min) ||
    Number.isNaN(sec) ||
    h < 0 ||
    h > 23 ||
    min < 0 ||
    min > 59 ||
    sec < 0 ||
    sec > 59
  ) {
    throw new Error("Time out of range");
  }
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function minutesFromMidnightHms(hms: string): number {
  const normalized = normalizeTimeToHms(hms);
  const [hh, mm, ss] = normalized.split(":").map(Number);
  return hh * 60 + mm + ss / 60;
}

/** True iff [startA, endA) overlaps [startB, endB) on the same calendar day. */
export function timeIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sa = minutesFromMidnightHms(startA);
  const ea = minutesFromMidnightHms(endA);
  const sb = minutesFromMidnightHms(startB);
  const eb = minutesFromMidnightHms(endB);
  return sa < eb && sb < ea;
}

export function formatSlotLabelFromTimes(startInput: string, endInput: string): string {
  const start = normalizeTimeToHms(startInput);
  const end = normalizeTimeToHms(endInput);
  const base = new Date(2000, 0, 1);
  const s = parse(start.slice(0, 5), "HH:mm", base);
  const e = parse(end.slice(0, 5), "HH:mm", base);
  return `${format(s, "h:mm a")} – ${format(e, "h:mm a")}`;
}
