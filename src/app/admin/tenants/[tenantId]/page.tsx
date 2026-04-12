import { redirect } from "next/navigation";
import { SuperAdminTenantDetailClient } from "@/components/superadmin/SuperAdminTenantDetailClient";
import { dashboardPathForRole } from "@/lib/auth/role-routes";
import { createClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ tenantId: string }> };

export default async function AdminTenantDetailPage({ params }: PageProps) {
  const { tenantId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/admin/tenants/${tenantId}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    redirect("/register");
  }

  if (profile.role !== "super_admin") {
    redirect(dashboardPathForRole(profile.role));
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6 lg:max-w-[1400px] lg:px-8">
      <SuperAdminTenantDetailClient tenantId={tenantId} />
    </main>
  );
}
