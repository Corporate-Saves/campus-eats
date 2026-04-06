import { z } from "zod";

export function formatZodBodyError(error: z.ZodError): string {
  const flat = error.flatten();
  const form = flat.formErrors[0];
  if (form) return form;
  const fieldParts: string[] = [];
  for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
    if (!Array.isArray(msgs)) continue;
    for (const msg of msgs) {
      fieldParts.push(`${key}: ${msg}`);
    }
  }
  if (fieldParts.length > 0) return fieldParts.join("; ");
  return "Invalid body";
}
