/** Domain part of an email, lowercased, or null if invalid. */
export function emailDomain(email: string | undefined | null): string | null {
  if (!email) return null;
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1]! : null;
}

export function domainAllowed(domain: string, whitelist: string[] | null | undefined) {
  if (!whitelist?.length) return false;
  const d = domain.toLowerCase();
  return whitelist.some((w) => w.replace(/^@/, "").toLowerCase() === d);
}
