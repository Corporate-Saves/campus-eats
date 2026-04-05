/** Aligns with DB: (scheduled_for + slot start) as UTC wall time, minus 30 minutes. */
export function computeCancelClosesAtIsoUtc(input: {
  scheduledFor: string | null;
  slotStartTime: string | null;
  hasSlot: boolean;
}): string | null {
  if (!input.hasSlot || !input.scheduledFor || !input.slotStartTime) {
    return null;
  }
  const timePart = input.slotStartTime.slice(0, 8);
  const slotStartMs = Date.parse(`${input.scheduledFor}T${timePart}Z`);
  if (Number.isNaN(slotStartMs)) return null;
  return new Date(slotStartMs - 30 * 60 * 1000).toISOString();
}
