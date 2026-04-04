/** Default home path after login / role-based redirect from middleware. */
export function dashboardPathForRole(role: string | null | undefined): string {
  switch (role) {
    case "student":
      return "/student/dashboard";
    case "canteen_staff":
      return "/staff/queue";
    case "canteen_owner":
      return "/owner/menu";
    case "institution_admin":
      return "/admin/institutions";
    case "super_admin":
      return "/admin/tenants";
    default:
      return "/login";
  }
}

export function roleAllowedForPathname(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!role) return false;
  if (pathname.startsWith("/student")) return role === "student";
  if (pathname.startsWith("/staff")) return role === "canteen_staff";
  if (pathname.startsWith("/owner")) return role === "canteen_owner";
  if (pathname.startsWith("/admin/tenants"))
    return role === "super_admin";
  if (pathname.startsWith("/admin"))
    return role === "institution_admin" || role === "super_admin";
  return true;
}
