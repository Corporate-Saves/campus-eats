import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  dashboardPathForRole,
  roleAllowedForPathname,
} from "@/lib/auth/role-routes";

const PROTECTED_PREFIXES = ["/student", "/staff", "/owner", "/admin"] as const;

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, institution_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as string | undefined;

  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    return NextResponse.redirect(url);
  }

  if (role !== "super_admin" && profile?.institution_id) {
    const { data: inst } = await supabase
      .from("institutions")
      .select("is_active, deleted_at")
      .eq("id", profile.institution_id)
      .maybeSingle();

    if (!inst || !inst.is_active || inst.deleted_at != null) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("tenant", "unavailable");
      const redirectResponse = NextResponse.redirect(url);
      const hdrs = supabaseResponse.headers;
      const getSetCookie = (
        hdrs as unknown as { getSetCookie?: () => string[] }
      ).getSetCookie;
      if (typeof getSetCookie === "function") {
        for (const c of getSetCookie.call(hdrs)) {
          redirectResponse.headers.append("Set-Cookie", c);
        }
      } else {
        const single = hdrs.get("set-cookie");
        if (single) redirectResponse.headers.append("Set-Cookie", single);
      }
      return redirectResponse;
    }
  }

  if (!roleAllowedForPathname(role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = dashboardPathForRole(role);
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/student/:path*",
    "/staff/:path*",
    "/owner/:path*",
    "/admin/:path*",
  ],
};
